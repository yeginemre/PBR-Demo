'use strict';

/**
 * Main application
 */

function main() {
    // ===== WebGL Context Setup =====
    const canvas = document.querySelector('#cv');
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        console.error('WebGL not supported');
        return;
    }

    // ===== Scene Configuration =====
    const CONFIG = {
        // Camera settings
        fieldOfView: 60,
        zNear: 1,
        zFar: 200.0,
        
        // Light settings
        lightColor: [1.0, 0.95, 0.8],    // Warm natural sunlight
        lightIntensity: 3.2,             // Moderate intensity
        lightRotationSpeed: 0.0015,      // Rotations per second
        lightHeight: 5.0,                // Height above sphere
        lightRadius: 2.0,                // Radius of rotation
        
        // Ambient light settings
        ambientColor: [0.2, 0.3, 0.2],   // Slightly green ambient for plants
        ambientIntensity: 0.05,          // Subtle ambient light

        // Animation
        worldRotationSpeed: 0.05         // Rotations per second
    };

    // ===== Initialize Components =====
    const camera = new Camera();
    const program = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (!program) return;

    // Get shader locations
    const programInfo = getProgramInfo(gl, program);

    // ===== Create Sphere Geometry =====
    const radius = 15;
    const latitudeBands = 30;
    const longitudeBands = 30;
    
    const { positions, texCoords, indices, normals } = createSphereGeometry();

    // Create and bind buffers
    const positionBuffer = initBuffer(gl, new Float32Array(positions));
    const texCoordBuffer = initBuffer(gl, new Float32Array(texCoords));
    const normalBuffer = initBuffer(gl, new Float32Array(normals));
    
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // ===== Load Textures =====
    const textures = loadSceneTextures(gl);

    // ===== Load Plant Model =====
    let plantModel = null;
    loadOBJWithMTL(gl, 'js/resources/bitki.obj', 'js/resources/bitki.mtl')
        .then(model => {
            plantModel = initPlantBuffers(gl, model);
        })
        .catch(error => console.error('Error loading plant model:', error));

    /**
     * Creates sphere geometry data
     * @returns {Object} Vertex data for sphere
     */
    function createSphereGeometry() {
        const positions = [];
        const texCoords = [];
        const indices = [];
        const normals = [];

        // Generate sphere vertex positions and texture coordinates
        for (let lat = 0; lat <= latitudeBands; lat++) {
            const theta = lat * Math.PI / latitudeBands;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let long = 0; long <= longitudeBands; long++) {
                const phi = long * 2 * Math.PI / longitudeBands;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                const x = cosPhi * sinTheta;
                const y = cosTheta;
                const z = sinPhi * sinTheta;

                const u = 1 - (long / longitudeBands);
                const v = 1 - (lat / latitudeBands);

                positions.push(radius * x, radius * y, radius * z);
                texCoords.push(u, v);
                normals.push(x, y, z);
            }
        }

        // Generate indices
        for (let lat = 0; lat < latitudeBands; lat++) {
            for (let long = 0; long < longitudeBands; long++) {
                const first = (lat * (longitudeBands + 1)) + long;
                const second = first + longitudeBands + 1;

                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }

        return { positions, texCoords, indices, normals };
    }

    /**
     * Gets all program locations
     * @param {WebGLRenderingContext} gl
     * @param {WebGLProgram} program
     * @returns {Object} Program info
     */
    function getProgramInfo(gl, program) {
        return {
            program: program,
            attribLocations: {
                position: gl.getAttribLocation(program, 'aPosition'),
                texCoord: gl.getAttribLocation(program, 'aTexCoord'),
                normal: gl.getAttribLocation(program, 'aNormal')
            },
            uniformLocations: {
                projection: gl.getUniformLocation(program, 'uProjection'),
                view: gl.getUniformLocation(program, 'uView'),
                world: gl.getUniformLocation(program, 'uWorld'),
                albedoMap: gl.getUniformLocation(program, 'uAlbedoMap'),
                normalMap: gl.getUniformLocation(program, 'uNormalMap'),
                metallicMap: gl.getUniformLocation(program, 'uMetallicMap'),
                roughnessMap: gl.getUniformLocation(program, 'uRoughnessMap'),
                aoMap: gl.getUniformLocation(program, 'uAOMap'),
                specularMap: gl.getUniformLocation(program, 'uSpecularMap'),
                shininess: gl.getUniformLocation(program, 'uShininess'),
                cameraPos: gl.getUniformLocation(program, 'uCameraPos'),
                lightDir: gl.getUniformLocation(program, 'uLightDir'),
                lightColor: gl.getUniformLocation(program, 'uLightColor'),
                lightIntensity: gl.getUniformLocation(program, 'uLightIntensity'),
                ambientColor: gl.getUniformLocation(program, 'uAmbientColor'),
                ambientIntensity: gl.getUniformLocation(program, 'uAmbientIntensity'),
                useSpecular: gl.getUniformLocation(program, 'uUseSpecular')
            }
        };
    }

    /**
     * Loads all scene textures
     * @param {WebGLRenderingContext} gl
     * @returns {Object} Texture objects
     */
    function loadSceneTextures(gl) {
        return {
            albedo: loadImageTexture(gl, 'js/textures/sand-dunes1_albedo.png'),
            normal: loadImageTexture(gl, 'js/textures/sand-dunes1_normal-dx.png'),
            metallic: loadImageTexture(gl, 'js/textures/sand-dunes1_metallic.png'),
            roughness: loadImageTexture(gl, 'js/textures/sand-dunes1_roughness.png'),
            ao: loadImageTexture(gl, 'js/textures/sand-dunes1_ao.png')
        };
    }

    /**
     * Initializes plant model buffers
     * @param {WebGLRenderingContext} gl
     * @param {Object} model Loaded model data
     * @returns {Object} Model with initialized buffers
     */
    function initPlantBuffers(gl, model) {
        return {
            ...model,
            positionBuffer: initBuffer(gl, model.positions),
            texcoordBuffer: initBuffer(gl, model.texcoords),
            normalBuffer: initBuffer(gl, model.normals),
            indexBuffer: (() => {
                const buffer = gl.createBuffer();
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indices, gl.STATIC_DRAW);
                return buffer;
            })()
        };
    }

    /**
     * Main render loop
     * @param {number} time Current time in milliseconds
     */
    function render(time) {
        // Handle canvas resize
        const canvas = gl.canvas;
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        }

        const aspect = gl.canvas.width / gl.canvas.height;

        // Set up GL state
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        const rotationAngle = time * CONFIG.worldRotationSpeed;

        // Set up matrices
        const projectionMatrix = perspective(CONFIG.fieldOfView, aspect, CONFIG.zNear, CONFIG.zFar);
        const viewMatrix = camera.update();
        const worldMatrix = rotate(rotationAngle, [0, 1, 0]);


        // Use shader program and set up attributes
        gl.useProgram(program);
        setupAttributes();
        updateUniforms();
        bindTextures();

        // Draw sphere
        gl.uniform1i(programInfo.uniformLocations.useSpecular, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

        // Draw plant if loaded
        if (plantModel) {
            drawPlant();
        }

        requestAnimationFrame(render);

        /**
         * Sets up vertex attributes
         */
        function setupAttributes() {
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.vertexAttribPointer(programInfo.attribLocations.position, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(programInfo.attribLocations.position);

            gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
            gl.vertexAttribPointer(programInfo.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(programInfo.attribLocations.texCoord);

            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
            gl.vertexAttribPointer(programInfo.attribLocations.normal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(programInfo.attribLocations.normal);
        }

        /**
         * Updates uniform values
         */
        function updateUniforms() {
            // Matrices
            gl.uniformMatrix4fv(programInfo.uniformLocations.projection, false, flatten(projectionMatrix));
            gl.uniformMatrix4fv(programInfo.uniformLocations.view, false, flatten(viewMatrix));
            gl.uniformMatrix4fv(programInfo.uniformLocations.world, false, flatten(worldMatrix));
            
            // Material properties
            gl.uniform1f(programInfo.uniformLocations.metallic, 0.0);
            gl.uniform1f(programInfo.uniformLocations.roughness, 0.5);

            // Camera position
            const cameraPos = camera.getEye();
            gl.uniform3f(programInfo.uniformLocations.cameraPos, cameraPos[0], cameraPos[1], cameraPos[2]);

            // Light direction
            const lightAngle = time * CONFIG.lightRotationSpeed;
            const x = CONFIG.lightRadius * Math.sin(lightAngle);
            const y = CONFIG.lightHeight;
            const z = CONFIG.lightRadius * Math.cos(lightAngle);
            const lightDir = normalize(vec3(-x, -y, -z));
            gl.uniform3f(programInfo.uniformLocations.lightDir, lightDir[0], lightDir[1], lightDir[2]);

            // Light properties
            gl.uniform3f(programInfo.uniformLocations.lightColor, ...CONFIG.lightColor);
            gl.uniform1f(programInfo.uniformLocations.lightIntensity, CONFIG.lightIntensity);
            gl.uniform3f(programInfo.uniformLocations.ambientColor, ...CONFIG.ambientColor);
            gl.uniform1f(programInfo.uniformLocations.ambientIntensity, CONFIG.ambientIntensity);
        }

        /**
         * Binds scene textures
         */
        function bindTextures() {
            const textureUnits = {
                albedo: 0,
                normal: 1,
                metallic: 2,
                roughness: 3,
                ao: 4
            };

            Object.entries(textures).forEach(([name, texture], index) => {
                gl.activeTexture(gl.TEXTURE0 + textureUnits[name]);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.uniform1i(programInfo.uniformLocations[name + 'Map'], textureUnits[name]);
            });
        }

        /**
         * Draws the plant model
         */
        function drawPlant() {
            gl.uniform1i(programInfo.uniformLocations.useSpecular, 1); // use specular lighting only for the plant
            
            const plantWorldMatrix = mult(worldMatrix, translate(0, radius, 0));
            gl.uniformMatrix4fv(programInfo.uniformLocations.world, false, flatten(plantWorldMatrix));
            
            gl.bindBuffer(gl.ARRAY_BUFFER, plantModel.positionBuffer);
            gl.vertexAttribPointer(programInfo.attribLocations.position, 3, gl.FLOAT, false, 0, 0);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, plantModel.texcoordBuffer);
            gl.vertexAttribPointer(programInfo.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, plantModel.normalBuffer);
            gl.vertexAttribPointer(programInfo.attribLocations.normal, 3, gl.FLOAT, false, 0, 0);
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, plantModel.indexBuffer);
            
            for (const mesh of plantModel.meshes) {
                if (mesh.material) {
                    setupPlantMaterial(mesh);
                }
                gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, mesh.startIndex * 2);
            }

            // Restore original lighting
            gl.uniform3f(programInfo.uniformLocations.lightColor, ...CONFIG.lightColor);
            gl.uniform1f(programInfo.uniformLocations.lightIntensity, CONFIG.lightIntensity);
            gl.uniform3f(programInfo.uniformLocations.ambientColor, ...CONFIG.ambientColor);
            gl.uniform1f(programInfo.uniformLocations.ambientIntensity, CONFIG.ambientIntensity);
        }

        /**
         * Sets up material properties for plant mesh
         * @param {Object} mesh Plant mesh data
         */
        function setupPlantMaterial(mesh) {
            // Bind textures
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, mesh.material.map_Kd);
            gl.uniform1i(programInfo.uniformLocations.albedoMap, 0);

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, mesh.material.map_Bump);
            gl.uniform1i(programInfo.uniformLocations.normalMap, 1);

            gl.activeTexture(gl.TEXTURE5);
            gl.bindTexture(gl.TEXTURE_2D, mesh.material.map_Ks || mesh.material.map_Kd);
            gl.uniform1i(programInfo.uniformLocations.specularMap, 5);

            // Material properties
            gl.uniform1f(programInfo.uniformLocations.metallic, 0.0);
            gl.uniform1f(programInfo.uniformLocations.roughness, 0.85);
            gl.uniform1f(programInfo.uniformLocations.shininess, mesh.material.shininess || 32.0);

            // Plant-specific lighting
            gl.uniform3f(programInfo.uniformLocations.lightColor, 0.4, 0.5, 0.3);
            gl.uniform1f(programInfo.uniformLocations.lightIntensity, 2.2);
            gl.uniform3f(programInfo.uniformLocations.ambientColor, 0.15, 0.2, 0.15);
            gl.uniform1f(programInfo.uniformLocations.ambientIntensity, 0.05);
        }
    }

    requestAnimationFrame(render);
}

// Start the application
main();
