const AdditiveShader = {
    uniforms: {
        "tDiffuse": { value: null},
        "tAdd": { value: null }
    },
    vertexShader: 
    `
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: 
    `
        uniform sampler2D tDiffuse;
        uniform sampler2D tAdd;

        varying vec2 vUv;

        void main() {
            gl_FragColor = vec4((texture2D(tDiffuse, vUv) + texture2D(tAdd, vUv)).xyz, 1.0);
        }
    `  
}