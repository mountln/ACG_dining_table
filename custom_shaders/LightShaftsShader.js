// Reference: https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process
const LightShaftsShader = {
    uniforms: {
        "tDiffuse": { value: null},
        "fLightX": { value: 0.5 },
        "fLightY": { value: 0.5 },
        "fExposure": { value: 1.0 },
        "fDecay": { value: 1.0 },
        "fDensity": { value: 1.0 },
        "fWeight": { value: 0.01 },
        "iSample": { value: 100 },
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
        uniform float fLightX;
        uniform float fLightY;
        uniform float fExposure;
        uniform float fDecay;
        uniform float fDensity;
        uniform float fWeight;
        uniform int iSample;

        varying vec2 vUv;

        void main() {
            vec2 alpha = vec2(fLightX, fLightY);  // Sun/light location
            vec2 phi = vUv;  // Screen-space image location
            vec2 deltaPhi = vec2(phi - alpha) / (float(iSample) * fDensity);  // One step from sun location to current location

            vec2 pos = vUv;
            float decayi = 1.0;
            vec3 color = vec3(0.0);
            for(int i = 0; i < iSample; i++) {
                pos -= deltaPhi;  // Move one step

                color += decayi * fWeight * texture2D(tDiffuse, pos).xyz;

                decayi *= fDecay;  // update decay^i
            }

            gl_FragColor = vec4(color * fExposure, 1.0);
        }
    `  
}