// A different golfing approach to https://www.shadertoy.com/view/3cdyWs
// Specification: https://en.wikipedia.org/wiki/File:Flag_of_China_(construction_sheet).svg
//   Center,size: (-10,5,3), (-5,1,1), (-3,3,1), (-3,6,1), (-5,8,1)
//   Colors: (238,28,37) and (255,255,0)

void mainImage( out vec4 o, in vec2 f )
{
    vec2 r = iResolution.xy,
         p = 12.*(f+f-r)/r.y,
         q = p*p;

    // background
    o = vec4(q.x<225. && q.y<1e2)*vec4(.93,.11,.145,0);

    // coordinate origin (large star)
    p -= vec2(-10,5); 
    
    // large star is 3 times larger
    q = p/3.; 
    
    // small stars
    for( int i=0; i++<5; )
        // repeat domain radially 5x                          
        q = length(q)*cos(mod(atan(q.x,-q.y)+o.w,1.26)+vec2(224,12)), // pi*(0.4,1.3,1.8)
        // draw triangle
        o.xy += 1.-min((3.*abs(q.x)+q-1.)*r/36.,1.).y,
        // position, rotation and size of next star
        q = vec2(5|i&2,7*i/3-6),
        o.w = atan(q.x,q.y),
        q -= p;
}