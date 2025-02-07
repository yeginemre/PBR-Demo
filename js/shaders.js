const vertexShaderSource = `#version 300 es
    // Input attributes from buffers
    in vec4 aPosition;    // Vertex position
    in vec2 aTexCoord;    // Texture coordinates
    in vec3 aNormal;      // Vertex normal

    // Output variables to fragment shader
    out vec2 vTexCoord;      // Pass texture coords to fragment shader
    out vec3 vNormal;        // Pass transformed normal
    out vec3 vWorldPos;      // Pass world position for lighting calculations

    // Transformation matrices
    uniform mat4 uProjection;    // Projection matrix
    uniform mat4 uView;          // View/Camera matrix
    uniform mat4 uWorld;         // World/Model matrix

    void main() {
        // Transform vertex to world space
        vec4 worldPos = uWorld * aPosition;
        
        // Final projected position
        gl_Position = uProjection * uView * worldPos;
        
        // Pass data to fragment shader
        vWorldPos = worldPos.xyz;
        vNormal = (uWorld * vec4(aNormal, 0.0)).xyz;  // Transform normal to world space
        vTexCoord = aTexCoord;
    }
`;

const fragmentShaderSource = `#version 300 es
    precision highp float;

    // Inputs from vertex shader
    in vec2 vTexCoord;
    in vec3 vNormal;
    in vec3 vWorldPos;

    // Output color
    out vec4 fragColor;

    // Camera and lighting uniforms
    uniform vec3 uCameraPos;
    uniform vec3 uLightDir;
    uniform vec3 uLightColor;
    uniform float uLightIntensity;
    uniform vec3 uAmbientColor;
    uniform float uAmbientIntensity;

    // Material textures
    uniform sampler2D uAlbedoMap;      // Base color
    uniform sampler2D uNormalMap;       // Normal mapping
    uniform sampler2D uMetallicMap;     // Metallic properties
    uniform sampler2D uRoughnessMap;    // Surface roughness
    uniform sampler2D uAOMap;           // Ambient occlusion
    uniform sampler2D uSpecularMap;     // Specular highlights
    uniform float uShininess;           // Specular power
    
    // Flag for specular
    uniform bool uUseSpecular;          // Enable/disable specular highlights

    const float PI = 3.14159265359;

    // ====== PBR Helper Functions ======
    
    // Calculates normal distribution for microfacet model
    float DistributionGGX(vec3 N, vec3 H, float roughness) {
        float a = roughness * roughness;
        float a2 = a * a;
        float NdotH = max(dot(N, H), 0.0);
        float NdotH2 = NdotH * NdotH;

        float nom = a2;
        float denom = (NdotH2 * (a2 - 1.0) + 1.0);
        denom = PI * denom * denom;

        return nom / denom;
    }

    // Geometry function - Describes self-shadowing of the microfacets
    float GeometrySchlickGGX(float NdotV, float roughness) {
        float r = (roughness + 1.0);
        float k = (r * r) / 8.0;

        float nom = NdotV;
        float denom = NdotV * (1.0 - k) + k;

        return nom / denom;
    }

    // Combined geometry function for both view and light directions
    float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
        float NdotV = max(dot(N, V), 0.0);
        float NdotL = max(dot(N, L), 0.0);
        float ggx2 = GeometrySchlickGGX(NdotV, roughness);
        float ggx1 = GeometrySchlickGGX(NdotL, roughness);

        return ggx1 * ggx2;
    }

    // Fresnel equation - Describes reflection ratio at different view angles
    vec3 fresnelSchlick(float cosTheta, vec3 F0) {
        return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
    }

    void main() {
        // ====== Sample Material Textures ======
        vec3 albedo = texture(uAlbedoMap, vTexCoord).rgb;
        float metallic = texture(uMetallicMap, vTexCoord).r;
        float roughness = texture(uRoughnessMap, vTexCoord).r;
        float ao = texture(uAOMap, vTexCoord).r;
        vec3 specularColor = texture(uSpecularMap, vTexCoord).rgb;
        
        // ====== Normal Mapping ======
        vec3 N = normalize(vNormal);
        vec3 normalMap = texture(uNormalMap, vTexCoord).rgb * 2.0 - 1.0;
        N = normalize(N + normalMap);
        
        // ====== View and Light Vectors ======
        vec3 V = normalize(uCameraPos - vWorldPos);
        vec3 L = normalize(-uLightDir);
        vec3 H = normalize(V + L);
        
        // ====== PBR Calculations ======
        // Base reflectivity
        vec3 F0 = vec3(0.04);
        F0 = mix(F0, albedo, metallic);
        
        // Light radiance
        vec3 radiance = uLightColor * uLightIntensity;
        
        // Cook-Torrance BRDF components
        float NDF = DistributionGGX(N, H, roughness);
        float G = GeometrySmith(N, V, L, roughness);
        vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
        
        // Combine BRDF terms
        vec3 numerator = NDF * G * F;
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
        vec3 specular = numerator / denominator;
        
        // Energy conservation
        vec3 kS = F;
        vec3 kD = vec3(1.0) - kS;
        kD *= 1.0 - metallic;
        
        float NdotL = max(dot(N, L), 0.0);
        
        // Blinn-Phong specular highlight for plant object
        float spec = pow(max(dot(N, H), 0.0), uShininess);
        vec3 specularHighlight = specularColor * spec;
        
        // Combine diffuse and specular lighting
        vec3 Lo = (kD * albedo / PI + specular) * radiance * NdotL;
        
        // Add ambient lighting
        vec3 ambient = uAmbientColor * uAmbientIntensity * albedo * ao;
        
        // ====== Final Color Composition ======
        vec3 color;
        if (uUseSpecular) {
            color = ambient + Lo + specularHighlight * 0.15;
        } else {
            color = ambient + Lo;
        }
        
        // Gamma correction for display
        color = pow(color, vec3(1.9/2.2));
        
        fragColor = vec4(color, 1.0);
    }
`;
