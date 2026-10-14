/* Native screenshots from the actual firmware drawing code. No mockup assets. */
#define IRONCLAD_GALLERY 1
#include "ui_render.c"
static void save(const char *out,const char *name) {
    cur_name=name; lint(); write_ppm(out,"IRONCLAD",name);
}
int main(int argc,char **argv) {
    const char *out=argc>1?argv[1]:"build/ironclad_ui";
    rep=stdout;
    setup(S_SPLASH);pal(UI_IRONCLAD_INDEX);cur_name="splash";
    nscr=npend=nrules=0;draw_splash();save(out,"splash");
    setup(S_HOME);pal(UI_IRONCLAD_INDEX);song.g[G_BPM]=160;draw(S_HOME);save(out,"home");
    setup(S_HOME);pal(UI_IRONCLAD_INDEX);song.g[G_BPM]=160;
    song.sel=0;set_engine_of(TSEL,0);apply_preset_to(TSEL,12);go_title("INSERT");draw(S_HOME);save(out,"metal-insert");
    setup(S_FM6_ALG5);pal(UI_IRONCLAD_INDEX);song.g[G_BPM]=160;
    apply_preset_to(TSEL,11);go_title("EDIT 1");draw(S_FM6_ALG5);save(out,"fm6");
    setup(S_DRUM);pal(UI_IRONCLAD_INDEX);song.g[G_BPM]=160;
    apply_preset_to(TSEL,4);go_page(GR_ROLL);draw(S_DRUM);save(out,"drums");
    printf("IRONCLAD native gallery: %u layout findings\n",nfind);
    return nfind?1:0;
}
