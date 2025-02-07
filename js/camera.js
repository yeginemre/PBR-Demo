"use strict";

class Camera {
    constructor() {
        // Camera state
        this.rotationX = 0;
        this.rotationY = 0;
        this.distance = 50;
        this.positionX = 0;
        this.positionY = 0;
        
        // Camera settings
        this.ROTATION_SENSITIVITY = 0.2;
        this.ZOOM_SENSITIVITY = 0.1;
        this.PAN_SENSITIVITY = 0.05;
        
        // Distance constraints
        this.MAX_DISTANCE = 10000;
        this.MIN_DISTANCE = 0;
        
        // Pointer lock state
        this.isPointerLocked = false;
        
        this.initControls();
    }
    
    initControls() {
        const canvas = document.querySelector("#cv");
        
        canvas.addEventListener('mousedown', (e) => {
            canvas.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === canvas;
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isPointerLocked) return;
            
            if (e.buttons === 1) {  // Left button - Rotation
                this.rotationY += e.movementX * this.ROTATION_SENSITIVITY;
                this.rotationX += e.movementY * this.ROTATION_SENSITIVITY;
                this.rotationX = Math.max(-89, Math.min(89, this.rotationX));
            }
            else if (e.buttons === 4) {  // Middle button - Zoom
                this.distance += e.movementY * this.ZOOM_SENSITIVITY;
                this.distance = Math.max(this.MIN_DISTANCE, Math.min(this.MAX_DISTANCE, this.distance));
            }
            else if (e.buttons === 2) {  // Right button - Pan
                this.positionX -= e.movementX * this.PAN_SENSITIVITY;
                this.positionY += e.movementY * this.PAN_SENSITIVITY;
            }
        });

        canvas.addEventListener('contextmenu', e => e.preventDefault());
    }
    
    update() {
        let matrix = mat4();
        
        matrix = mult(matrix, translate(0, 0, -this.distance));
        
        matrix = mult(matrix, translate(this.positionX, this.positionY, 0));
        matrix = mult(matrix, rotate(this.rotationX, [1, 0, 0]));
        matrix = mult(matrix, rotate(this.rotationY, [0, 1, 0]));
        
        return matrix;
    }
    
    getEye() {
        // Calculate eye position for lighting
        const distance = this.distance;
        const rotX = radians(this.rotationX);
        const rotY = radians(this.rotationY);
        
        const x = distance * Math.sin(rotY) + this.positionX;
        const y = distance * Math.sin(rotX) + this.positionY;
        const z = distance * Math.cos(rotY);
        
        return vec3(x, y, z);
    }
}