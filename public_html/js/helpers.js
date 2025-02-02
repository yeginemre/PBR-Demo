function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }
    return shaderProgram;
}


function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function initBuffer(gl, data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(data), gl.STATIC_DRAW);
    return buffer;
}


"use strict";

/**
 * Creates and loads a WebGL texture from either pixel data or an image URL
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {string|Uint8Array} source - Either an image URL or pixel data
 * @returns {WebGLTexture} The created texture object
 */
function loadImageTexture(gl, source) {
    // Create and bind a new texture object
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Handle direct pixel data
    if (source instanceof Uint8Array) {
        createTextureFromPixels(gl, source);
        return texture;
    }

    // Handle image URL
    createTemporaryTexture(gl);
    loadImageFromURL(gl, texture, source);
    
    return texture;
}

/**
 * Creates a texture from raw pixel data
 * @param {WebGLRenderingContext} gl 
 * @param {Uint8Array} pixels - RGBA pixel data
 */
function createTextureFromPixels(gl, pixels) {
    gl.texImage2D(
        gl.TEXTURE_2D,    // target
        0,                // level
        gl.RGBA,         // internal format
        1,               // width
        1,               // height
        0,               // border
        gl.RGBA,         // format
        gl.UNSIGNED_BYTE, // type
        pixels           // data
    );
}

/**
 * Creates a temporary 1x1 blue pixel texture while image loads
 * @param {WebGLRenderingContext} gl 
 */
function createTemporaryTexture(gl) {
    const tempPixel = new Uint8Array([0, 0, 255, 255]); // Blue pixel
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        tempPixel
    );
}

/**
 * Loads an image from URL and creates a texture from it
 * @param {WebGLRenderingContext} gl 
 * @param {WebGLTexture} texture 
 * @param {string} url 
 */
function loadImageFromURL(gl, texture, url) {
    const image = new Image();
    image.src = url;
    
    image.addEventListener('load', function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
        );
        
        setupTextureFiltering(gl, image);
    });
}

/**
 * Sets up appropriate texture filtering based on image dimensions
 * @param {WebGLRenderingContext} gl 
 * @param {HTMLImageElement} image 
 */
function setupTextureFiltering(gl, image) {
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
        // For power of 2 textures, use mipmaps
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    } else {
        // For non-power of 2 textures, use linear filtering and clamp
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
}

/**
 * Checks if a number is a power of 2
 * @param {number} value - The number to check
 * @returns {boolean} True if the number is a power of 2
 */
function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
} 