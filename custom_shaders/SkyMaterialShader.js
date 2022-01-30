const SkyMaterialShader = {
    uniforms: {
        "fTurbidity": { value: 10},
        "fRayleighWeight": { value: 3},
        "fMieWeight": { value: 0.005},
        "fMieG": { value: 0.7 },
        "fSunPositionX": { value: 0.0 },
        "fSunPositionY": { value: 0.02 },
        "fSunPositionZ": { value: -1.0 }
    },
    vertexShader:
    `
        varying vec3 worldPos;

        void main() {
            worldPos = (modelMatrix * vec4(position, 1.0)).xyz;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position.z = gl_Position.w;  // Set gl_Position.z to camera.far
        }
    `,
    fragmentShader:
    `
        uniform float fTurbidity;
        uniform float fRayleighWeight;
        uniform float fMieWeight;
        uniform float fMieG;
        // TODO: Add GUI to change sun position
        uniform float fSunPositionX;
        uniform float fSunPositionY;
        uniform float fSunPositionZ;

        varying vec3 worldPos;

        // The irradiance of the sun
        const float E_sun = 100.0;

        // Set camera to center
        const vec3 cameraPos = vec3(0.0, 0.0, 0.0);

        const float pi = 3.1415927;

        // Lambda in this project: Red=630nm, Green=530nm, Blue=470nm
        vec3 calculate_beta_R(float rayleighWeight) {
            // (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn))
            // n=1.0003, pn=0.035, N=2.545E1025
            // rayleighWeight is used to adjust the strength of Rayleigh scattering
            return vec3(7.8784627E-6, 1.5728967E-5, 2.5433859E-5) * rayleighWeight;
        }
        vec3 calculate_beta_M(float T, float mieWeight) {
            // float c = (0.6544 * T - 0.6510) * 10E-16;
            float c = (0.2 * T) * 10E-18;
            // 0.434 * c * pi * pow((2.0 * pi) / lambda, vec3(v - 2.0)) * K
            // v=4, K=vec3(0.684, 0.676, 0.669)
            // mieWeight is used to adjust the strength of Mie scattering
            return 0.434 * c * vec3(2.1373941E14, 2.9847267E14, 3.7561248E14) * mieWeight;
        }

        float rayleighPhase(float cosTheta) {
            // 3.0 / (16.0 * pi) * (1.0 + pow(cosTheta, 2.0));
            return 0.059683104 * (1.0 + pow(cosTheta, 2.0));
        }
    
        float hgPhase(float cosTheta, float g) {
            // 1.0 / ( 4.0 * pi ) * (1.0 - pow(g, 2.0)) / pow(1.0  + pow(g, 2.0) - 2.0 * g * cosTheta, 3 / 2)
            return 0.079577472 * ((1.0 - pow(g, 2.0)) / pow(1.0 + pow(g, 2.0) - 2.0 * g * cosTheta, 1.5));
        }
    
        void main() {
            // Normalized sun direction
            vec3 sunDirection = normalize(vec3(fSunPositionX, fSunPositionY, fSunPositionZ));
            // Normalized view direction
            vec3 viewDirection = normalize(worldPos - cameraPos);
            // The view zenith angle (cutoff at 90 degree)
            float theta_v = acos(max(0.0, dot(vec3(0.0, 1.0, 0.0), viewDirection)));
            // Theta: the angle from the view vector to the sun vector
            float cosTheta = dot(viewDirection, sunDirection);
            // Theta_s: the sun zenith angle
            float cosTheta_s = dot(vec3(0.0, 1.0, 0.0), sunDirection);

            // Compute the angular and total scattering coefficients
            // The total scattering coefficient for Rayleigh scattering
            vec3 beta_R = calculate_beta_R(fRayleighWeight);
            // The total scattering coefficient for Rayleigh scattering
            vec3 beta_M = calculate_beta_M(fTurbidity, fMieWeight);
            // The angular scattering coefficient for Rayleigh scattering
            vec3 beta_RTheta = beta_R * rayleighPhase(cosTheta);
            // The angular scattering coefficient for  scattering
            vec3 beta_MTheta = beta_M * hgPhase(cosTheta, fMieG);

            // Compute extinction factor
            // - Method 1 (reference: [2])
            // The distance to the camera
            // float s = length(worldPos - cameraPos);
            // Extinction factor
            // vec3 F_ex = exp(-(beta_R + beta_M) * s);
            // - Method 2 (looks better)
            // renference: https://threejs.org/examples/webgl_shaders_sky.html
            // Relative optical mass
            float m = 1.0 / (cos(theta_v) + 0.15 * pow(93.885 - ((theta_v * 180.0) / pi), -1.253));
            // Calculate optical distance instead of the distance to the camera
            // 8.4E3, 1/25E3 are optical length at zenith for molecules
            float s_R = 8.4E3 * m;
            float s_M = 1.25E3 * m;
            // Extinction factor
            vec3 F_ex = exp(-(beta_R * s_R + beta_M * s_M));

            // vec3 L_in = E_sun * ((beta_RTheta + beta_MTheta) / (beta_R + beta_M)) * (1.0 - F_ex);
            vec3 L_in = pow(E_sun * ((beta_RTheta + beta_MTheta) / (beta_R + beta_M)) * (1.0 - F_ex), vec3(1.5));
            L_in *= mix(vec3(1.0), pow(E_sun * ((beta_RTheta + beta_MTheta) / (beta_R + beta_M)) * F_ex, vec3(0.5)), clamp(pow(1.0 - cosTheta_s, 5.0), 0.0, 1.0));

            vec3 L_0 = vec3(0.1);  // TODO: use objects colors as L_0

            // The sun representation
            // reference: https://threejs.org/examples/webgl_shaders_sky.html
            // Theta_d is a variable used to express the angular diameter of the sun
            const float cosTheta_d = 0.99995668;
            float sun = smoothstep(cosTheta_d, cosTheta_d + 0.00002, cosTheta);
            L_0 += (E_sun * 19000.0) * sun;

            vec3 color = pow((L_0 * F_ex + L_in) * 0.04, vec3(0.5));

            gl_FragColor = vec4(color, 1.0);

            #include <tonemapping_fragment>
            #include <encodings_fragment>
        }
    `
}