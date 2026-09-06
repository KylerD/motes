import * as T from 'three';

/** A low-resolution scene print with stable pigment grain and warm halation.
 * UI stays in the DOM at native resolution. No wall clock or random state enters this pass. */
export class PostcardPass {
  private target: T.WebGLRenderTarget;
  private scene = new T.Scene();
  private camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: T.ShaderMaterial;
  private geometry = new T.PlaneGeometry(2, 2);

  constructor(renderer: T.WebGLRenderer) {
    this.target = new T.WebGLRenderTarget(1, 1, {
      type: renderer.extensions.has('EXT_color_buffer_float') ? T.HalfFloatType : T.UnsignedByteType,
      minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: true,
    });
    this.material = new T.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { picture: { value: this.target.texture }, resolution: { value: new T.Vector2(1, 1) }, softness: { value: 1 } },
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: `uniform sampler2D picture; uniform vec2 resolution; uniform float softness; varying vec2 vUv;
        float grain(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        vec3 lightAt(vec2 offset) {
          vec3 c = texture2D(picture, vUv + offset / resolution).rgb;
          return max(c - vec3(.68), vec3(0.));
        }
        void main() {
          vec3 c = texture2D(picture, vUv).rgb;
          vec3 glow = lightAt(vec2(0.)) * .2;
          glow += (lightAt(vec2(3.,0.)) + lightAt(vec2(-3.,0.)) + lightAt(vec2(0.,3.)) + lightAt(vec2(0.,-3.))) * .12;
          glow += (lightAt(vec2(7.,4.)) + lightAt(vec2(-7.,4.)) + lightAt(vec2(7.,-4.)) + lightAt(vec2(-7.,-4.))) * .08;
          c += glow * .48 * softness;
          float luminance = dot(c, vec3(.2126,.7152,.0722));
          c = mix(vec3(luminance), c, .92);
          c += vec3(.027,.013,.042) * (1. - smoothstep(.025,.6,luminance));
          c *= vec3(1.045,.99,1.015);
          gl_FragColor = vec4(c, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          float fleck = grain(floor(vUv * resolution));
          // Quantised pigment gives gradients a quiet, printed texture, without moving static.
          vec3 ink = floor(gl_FragColor.rgb * 48. + fleck * .7) / 48.;
          gl_FragColor.rgb = mix(gl_FragColor.rgb, ink, .6 * softness);
          gl_FragColor.rgb += (fleck - .5) * .014 * softness;
          vec2 edge = (vUv - .5) * vec2(1.,.8);
          gl_FragColor.rgb *= 1. - dot(edge, edge) * .24;
        }`,
    });
    this.scene.add(new T.Mesh(this.geometry, this.material));
  }
  resize(width: number, height: number): void {
    const w = Math.max(1, Math.round(Math.min(864, Math.max(240, width * 0.67)))), h = Math.max(1, Math.round(w * height / width));
    this.target.setSize(w, h); this.material.uniforms.resolution.value.set(w, h);
  }
  draw(renderer: T.WebGLRenderer, scene: T.Scene, camera: T.Camera, life: boolean): void {
    this.material.uniforms.softness.value = life ? 1 : 0.25;
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }
  dispose(): void { this.target.dispose(); this.material.dispose(); this.geometry.dispose(); }
}

/** Mottled pigment is anchored to the world, not camera movement. */
export function paintedMaterial(color: string | T.Color, emissive = false): T.MeshStandardMaterial {
  const material = new T.MeshStandardMaterial({ color, roughness: 1, metalness: 0, emissive: emissive ? color : '#000000', emissiveIntensity: emissive ? 2.5 : 0 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vPigment;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      vec4 pigmentPosition = vec4(transformed, 1.);
      #ifdef USE_INSTANCING
        pigmentPosition = instanceMatrix * pigmentPosition;
      #endif
      vPigment = (modelMatrix * pigmentPosition).xyz;
      #include <project_vertex>`);
    shader.fragmentShader = `varying vec3 vPigment;
      float pigmentHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453); }
      float pigmentNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(pigmentHash(i),pigmentHash(i+vec2(1.,0.)),f.x),mix(pigmentHash(i+vec2(0.,1.)),pigmentHash(i+vec2(1.)),f.x),f.y);
      }
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 paper = vPigment.xz + vPigment.y * vec2(.31,.57);
      float wash = pigmentNoise(paper * 9.) * .13 + pigmentNoise(paper * 34.) * .075;
      diffuseColor.rgb *= .87 + wash;
    `);
  };
  material.customProgramCacheKey = () => 'motes-pigment-v1';
  return material;
}
