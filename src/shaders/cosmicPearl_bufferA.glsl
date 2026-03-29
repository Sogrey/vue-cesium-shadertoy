// Cosmic Pearl - Buffer A
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (2.*fragCoord.xy - iResolution.xy) / iResolution.y;
    float focal = 2.5;
    float distortion = 1. - sin(iTime*.053)* (.1 - .1*length(uv));
    vec3 rd = normalize(vec3(uv.xy*distortion, -focal)); 
    vec3 ro = vec3(-.0,.1,1.) + rd *.05;
    vec3 color = vec3(0);
    float density = 0.;
    float radius = 1.;
    for (float i = 0.; i < 56.; i++) 
    {
        color += 
        (.5-.5*sin(.75+7.*density + vec3(1,2,3))) * 
        ((density*.4+1.-exp(-abs(density)))*0.04 + 1./(5e-4+abs(density))*1e-6);

        vec3 dt = rd * density * 0.18;
        ro += dt * radius;
        if (i > 32.0) rd = vec3(0,1,1);
        radius = length(ro);
        
        vec3 q = vec3(
            log2(radius) - iTime*.175, 
           -1.+ro.z / radius, 
           atan(ro.x, ro.y)
        );
        
        density = q.y;
        float scale = 1.;
        for (int j = 0; j < 10; j++)
        {
            vec3 noiseCoord = q * scale;
            vec3 wave = (cos(noiseCoord*1.15)-.5);
            density += cos(dot(wave, wave.zxy)) / scale;
            scale *= 2.; 
        }
    }
    color = mix(color, texelFetch(iChannel0, ivec2(fragCoord), 0).rgb, .7);
    if(iFrame==0) color = vec3(0);
    fragColor = vec4(color, 1);
}
