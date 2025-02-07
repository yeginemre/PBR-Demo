"use strict";

/**
 * OBJ and MTL file loader
 */

/**
 * Loads an OBJ file and its associated MTL file
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {string} objUrl - URL to the OBJ file
 * @param {string} mtlUrl - URL to the MTL file
 * @returns {Promise} - Resolves with the processed geometry and materials
 */
function loadOBJWithMTL(gl, objUrl, mtlUrl) {
    return new Promise((resolve, reject) => {
        // First load the MTL file to get material definitions
        fetch(mtlUrl)
            .then(response => response.text())
            .then(mtlData => {
                const materials = parseMTL(gl, mtlData);
                // Then load the OBJ file
                return fetch(objUrl)
                    .then(response => response.text())
                    .then(objData => {
                        const result = parseOBJ(objData);
                        resolve(createGeometryWithMaterials(gl, result, materials));
                    });
            })
            .catch(error => reject(error));
    });
}

/**
 * Parses MTL (Material Template Library) file content
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {string} text - The MTL file content
 * @returns {Object} - Parsed materials dictionary
 */
function parseMTL(gl, text) {
    const materials = {};
    let material;

    // Material property handlers
    const keywords = {
        newmtl(parts, unparsedArgs) {
            // Start a new material
            material = {};
            materials[unparsedArgs] = material;
        },
        // Material properties
        Ns(parts)     { material.shininess = parseFloat(parts[0]); },
        Ka(parts)     { material.ambient = parts.map(parseFloat); },
        Kd(parts)     { material.diffuse = parts.map(parseFloat); },
        Ks(parts)     { material.specular = parts.map(parseFloat); },
        Ke(parts)     { material.emissive = parts.map(parseFloat); },
        Ni(parts)     { material.opticalDensity = parseFloat(parts[0]); },
        d(parts)      { material.opacity = parseFloat(parts[0]); },
        illum(parts)  { material.illum = parseInt(parts[0]); },
        
        // Texture maps
        map_Kd(parts) { 
            material.map_Kd = loadTextureFromPath(gl, parts);
        },
        map_Bump(parts) {
            material.map_Bump = loadTextureFromPath(gl, parts);
        },
        map_Ks(parts) {
            material.map_Ks = loadTextureFromPath(gl, parts);
        }
    };

    // Helper function for texture path processing
    function loadTextureFromPath(gl, parts) {
        const texturePath = parts.join(' ').replace(/\\/g, '/');
        const fullPath = 'js/' + texturePath;
        return loadImageTexture(gl, fullPath);
    }

    // Process each line of the MTL file
    const lines = text.split('\n');
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;

        const parts = line.split(/\s+/);
        const keyword = parts[0];
        const handler = keywords[keyword];
        if (handler) {
            handler(parts.slice(1), parts.slice(1).join(' '));
        }
    }

    return materials;
}

/**
 * Parses OBJ file content
 * Custom implementation with optimizations for WebGL
 * @param {string} text - The OBJ file content
 * @returns {Object} - Parsed geometry data
 */
function parseOBJ(text) {
    // Initialize data arrays with default values
    const positions = [[0, 0, 0]];  // Start at index 1
    const texcoords = [[0, 0]];     // Start at index 1
    const normals = [[0, 0, 0]];    // Start at index 1
    
    // Arrays for final processed data
    const vertexMap = new Map();    // For vertex deduplication
    const finalPositions = [];
    const finalTexcoords = [];
    const finalNormals = [];
    const indices = [];
    const geometries = [];
    let geometry = null;
    let vertexCount = 0;

    /**
     * Starts a new geometry section with the given material
     * @param {string} material - Material name
     */
    function startGeometry(material) {
        if (geometry) {
            geometry.indexCount = indices.length - geometry.startIndex;
            if (geometry.indexCount > 0) {
                geometries.push(geometry);
            }
        }
        geometry = {
            material: material,
            startIndex: indices.length,
            indexCount: 0
        };
    }

    /**
     * Adds a vertex to the final arrays with deduplication
     * @param {number} posIndex - Position index
     * @param {number} texIndex - Texture coordinate index
     * @param {number} normIndex - Normal index
     * @returns {number} - The index of the vertex
     */
    function addVertex(posIndex, texIndex, normIndex) {
        // Handle negative indices (relative to end of array)
        posIndex = posIndex > 0 ? posIndex : positions.length + posIndex;
        texIndex = texIndex > 0 ? texIndex : texcoords.length + texIndex;
        normIndex = normIndex > 0 ? normIndex : normals.length + normIndex;
        
        // Create unique key for vertex deduplication
        const key = `${posIndex}/${texIndex}/${normIndex}`;
        let index = vertexMap.get(key);
        
        // If vertex doesn't exist, add it
        if (index === undefined) {
            index = vertexCount++;
            vertexMap.set(key, index);
            
            // Get vertex attributes, using defaults if not specified
            const position = positions[posIndex] || [0, 0, 0];
            const texcoord = texcoords[texIndex] || [0, 0];
            const normal = normals[normIndex] || [0, 1, 0];
            
            finalPositions.push(...position);
            finalTexcoords.push(...texcoord);
            finalNormals.push(...normal);
        }
        
        return index;
    }

    // Process each line of the OBJ file
    const lines = text.split('\n');
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;

        const parts = line.split(/\s+/);
        const command = parts[0];

        switch (command) {
            case 'v':  // Vertex position
                positions.push(parts.slice(1, 4).map(parseFloat));
                break;

            case 'vt':  // Texture coordinate
                texcoords.push([
                    parseFloat(parts[1]),
                    1 - parseFloat(parts[2])  // Flip Y coordinate for WebGL
                ]);
                break;

            case 'vn':  // Vertex normal
                // Normalize the normal vector
                const [x, y, z] = parts.slice(1, 4).map(parseFloat);
                const length = Math.sqrt(x * x + y * y + z * z);
                normals.push([x/length, y/length, z/length]);
                break;

            case 'usemtl':  // Material
                startGeometry(parts[1]);
                break;

            case 'f':  // Face
                if (!geometry) {
                    startGeometry('default');
                }

                // Parse face vertices and triangulate if necessary
                const vertices = parts.slice(1).map(vert => {
                    const [v, t, n] = vert.split('/').map(v => parseInt(v) || 0);
                    return {vert: v, tex: t, norm: n};
                });

                // Triangulate faces with more than 3 vertices
                for (let i = 1; i < vertices.length - 1; i++) {
                    const v0 = vertices[0];
                    const v1 = vertices[i];
                    const v2 = vertices[i + 1];

                    indices.push(
                        addVertex(v0.vert, v0.tex, v0.norm),
                        addVertex(v1.vert, v1.tex, v1.norm),
                        addVertex(v2.vert, v2.tex, v2.norm)
                    );
                }
                break;
        }
    }

    // Handle the last geometry section
    if (geometry) {
        geometry.indexCount = indices.length - geometry.startIndex;
        if (geometry.indexCount > 0) {
            geometries.push(geometry);
        }
    }

    return {
        positions: finalPositions,
        texcoords: finalTexcoords,
        normals: finalNormals,
        indices: indices,
        geometries: geometries
    };
}

/**
 * Creates final geometry with materials
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {Object} objData - Parsed OBJ data
 * @param {Object} materials - Parsed materials
 * @returns {Object} - Final geometry with materials
 */
function createGeometryWithMaterials(gl, objData, materials) {
    return {
        // Vertex data arrays
        positions: new Float32Array(objData.positions),
        texcoords: new Float32Array(objData.texcoords),
        normals: new Float32Array(objData.normals),
        indices: new Uint16Array(objData.indices),
        
        // Material data for each mesh
        meshes: objData.geometries.map(geom => ({
            material: {
                ...materials[geom.material],
                // Default material properties if not specified
                shininess: materials[geom.material]?.shininess || 32.0,
                ambient: materials[geom.material]?.ambient || [1.0, 1.0, 1.0],
                diffuse: materials[geom.material]?.diffuse || [0.64, 0.64, 0.64],
                specular: materials[geom.material]?.specular || [0.2, 0.2, 0.2],
                opacity: materials[geom.material]?.opacity || 1.0,
                illum: materials[geom.material]?.illum || 2
            },
            startIndex: geom.startIndex,
            indexCount: geom.indexCount
        }))
    };
} 