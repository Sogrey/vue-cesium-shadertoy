// Renkli Taşlar (彩色石头)
// Author: https://www.shadertoy.com/view/7fSGDt

#define ANIMATED
#define GLOW
#define SCROLLING
//#define SHOW_CHECKER
//#define SHOW_GRID
//#define SHOW_ID
//#define SHOW_UV

#define TAU 6.28318530718

const float SCALE      = 4.;
const float SMOOTHNESS = 0.15;

// Yardımcı fonksiyonlar
float hash12(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p.yx + 19.19);
    return fract((p.x + p.y) * p.x);
}

float smin(float a, float b, float k) {
    float h = clamp(.5 + .5*(b-a)/k, 0., 1.);
    return mix(b, a, h) - k*h*(1.-h);
}

// Her taşa benzersiz, doygun renk
vec3 stoneColor(vec2 id) {
    float h  = hash12(id);
    float h2 = hash12(id + vec2(17.3, 31.7));
    float h3 = hash12(id + vec2(53.1, 97.4));

    // Altın oran ile eşit dağılımlı ton ayrımı
    float hue = fract(h * 1.6180339);

    float angle = hue * TAU;
    float r = 0.5 + 0.5 * sin(angle);
    float g = 0.5 + 0.5 * sin(angle + 2.094);
    float b = 0.5 + 0.5 * sin(angle + 4.189);

    // Doygunluk: 0.6 – 1.0 arası
    float sat = 0.6 + 0.4 * h2;
    float lum = dot(vec3(r,g,b), vec3(0.299,0.587,0.114));
    vec3  col = mix(vec3(lum), vec3(r,g,b), sat);

    // Parlaklık: 0.45 – 0.85 arası
    col *= 0.45 + 0.40 * h3;

    return col;
}

// Animasyonlu span
float randSpan(vec2 p) {
    #ifdef ANIMATED
    return (sin(iTime*1.6 + hash12(p)*TAU)*.5+.5)*.6+.2;
    #else
    return hash12(p)*.6+.2;
    #endif
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (2.*fragCoord - iResolution.xy) / iResolution.y;
    uv *= SCALE;

    #ifdef SCROLLING
    uv += vec2(.7, .5) * iTime;
    #endif

    vec2 fl = floor(uv);
    vec2 fr = fract(uv);

    bool ch = mod(fl.x + fl.y, 2.) > .5;

    float r1  = randSpan(fl);
    vec2  ax  = ch ? fr.xy : fr.yx;

    float a1  = ax.x - r1;
    float si  = sign(a1);
    vec2  o1  = ch ? vec2(si, 0) : vec2(0, si);

    float r2  = randSpan(fl + o1);
    float a2  = ax.y - r2;

    vec2 st = step(vec2(0), vec2(a1, a2));

    // Tile ID
    vec2 of = ch ? st.xy : st.yx;
    vec2 id = fl + of - 1.;

    bool ch2 = mod(id.x + id.y, 2.) > .5;

    float r00 = randSpan(id + vec2(0,0));
    float r10 = randSpan(id + vec2(1,0));
    float r01 = randSpan(id + vec2(0,1));
    float r11 = randSpan(id + vec2(1,1));

    vec2 s0 = ch2 ? vec2(r00, r10) : vec2(r01, r00);
    vec2 s1 = ch2 ? vec2(r11, r01) : vec2(r10, r11);
    vec2 s  = 1. - s0 + s1;

    vec2 puv = (uv - id - s0) / s;

    // Border Distance
    vec2  b = (.5 - abs(puv - .5)) * s;
    float d = smin(b.x, b.y, SMOOTHNESS);
    float l = smoothstep(.02, .06, d);

    // Highlights
    vec2  hp = (1. - puv) * s;
    float h  = smoothstep(.08, .0, max(smin(hp.x, hp.y, SMOOTHNESS), 0.));

    // Shadows
    vec2  sp = puv * s;
    float sh = smoothstep(.05, .12, max(smin(sp.x, sp.y, SMOOTHNESS), 0.));

    // Renk (doku yok)
    vec3 col = stoneColor(id);

    // Yüzey degradesi — taşın hacim hissi
    col *= puv.x * 0.4 + 0.6;
    col *= puv.y * 0.3 + 0.7;

    // Gölge ve highlight
    col *= sh * 0.8 + 0.2;
    col += h * vec3(0.9, 0.8, 0.7);

    // Kenar
    col *= l * 5.;

    // Glow
    #ifdef GLOW
    vec2 gv = (1.1 - fragCoord / iResolution.xy) * iResolution.x / iResolution.y;
    col += pow(.12 / length(gv), 1.5) * vec3(1., .8, .4) * (l*0.3 + 0.7);
    #endif

    #ifdef SHOW_ID
    col = vec3(id, 0);
    #endif
    #ifdef SHOW_UV
    col = vec3(puv, 0);
    #endif
    #ifdef SHOW_GRID
    vec2 gd = .5 - abs(fr - .5);
    float grid = smoothstep(.03, .02, min(gd.x, gd.y));
    col = mix(col, vec3(.2, .9, 1), grid);
    #endif
    #ifdef SHOW_CHECKER
    col = mix(col, (ch ? vec3(1,.2,.2) : vec3(.2,1,.2)), .2);
    #endif

    col = max(col, vec3(0));
    col = col / (1. + col);
    col = pow(col, vec3(1./2.2));

    fragColor = vec4(col, 1);
}
