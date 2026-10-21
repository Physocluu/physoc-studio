(function () {
  "use strict";
  var templates = window.PHYSOC_TEMPLATES;
  var atom = templates.find(function (t) { return t.slug === "social-post"; }).html.match(/<svg[\s\S]*?<\/svg>/)[0];
  function svg(content) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 400" width="100%" height="100%" fill="none" aria-hidden="true">' + content + '</svg>';
  }
  function mug(x, angle, fill) {
    return '<g transform="translate(' + x + ' 45) rotate(' + angle + ' 100 160)" stroke="#07140E" stroke-width="6" stroke-linejoin="round"><path d="M160 100h38c65 0 65 135 0 135h-38" fill="#FAFAFA"/><rect x="15" y="85" width="150" height="230" rx="22" fill="' + fill + '"/><path d="M55 145v110m35-110v110m35-110v110" stroke="#2E7D32" stroke-linecap="round"/><path d="M15 105C-10 105-12 62 16 60 9 25 57 15 73 42 98 7 143 23 142 53 184 36 200 95 165 105Z" fill="#FAFAFA"/></g>';
  }
  function die(x, y, angle, fill, six) {
    var dots = six ? [[40,40],[110,40],[40,75],[110,75],[40,110],[110,110]] : [[40,40],[110,40],[75,75],[40,110],[110,110]];
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + angle + ' 75 75)"><rect x="9" y="12" width="150" height="150" rx="30" fill="#07140E"/><rect width="150" height="150" rx="30" fill="' + fill + '" stroke="#07140E" stroke-width="5"/>' + dots.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="13" fill="#07140E"/>'; }).join('') + '</g>';
  }
  var graphics = {
    pub: svg('<circle cx="260" cy="205" r="175" fill="#FAFAFA"/><circle cx="475" cy="215" r="165" fill="#5AD1A0"/>' + mug(140,-12,"#BFF36A") + mug(385,12,"#5AD1A0") + '<path d="M327 28l10 25m35-28l-9 26" stroke="#2E7D32" stroke-width="7" stroke-linecap="round"/>'),
    sober: svg('<g stroke="#07140E" stroke-width="6" stroke-linejoin="round"><g transform="rotate(-9 240 220)"><path d="M140 115h185l-25 215H165z" fill="#FAFAFA"/><path d="M150 195h166l-16 135H165z" fill="#5AD1A0"/><path d="M260 250l25-215h65" stroke="#2E7D32" stroke-linecap="round"/><rect x="180" y="210" width="36" height="36" rx="6" fill="#FAFAFA"/><rect x="235" y="263" width="30" height="30" rx="6" fill="#FAFAFA"/></g><circle cx="140" cy="130" r="47" fill="#BFF36A"/><path d="M140 91v78m-39-39h78m-66-28l55 55m0-55l-55 55" stroke="#2E7D32" stroke-width="4"/><path d="M355 245h240c-15 125-225 125-240 0z" fill="#BFF36A"/><ellipse cx="475" cy="245" rx="120" ry="25" fill="#FAFAFA"/><path d="M383 240l22-60 48 54z" fill="#5AD1A0"/><path d="M440 242l28-60 45 62z" fill="#BFF36A"/><path d="M501 240l44-54 24 61z" fill="#5AD1A0"/></g><g transform="translate(460 48) scale(.72)">' + die(0,0,12,"#FAFAFA") + '</g>'),
    study: svg('<g transform="rotate(-7 350 210)" stroke="#07140E" stroke-width="6" stroke-linejoin="round"><path d="M120 105q120-45 230 0 110-45 230 0v230q-120-35-230 0-110-35-230 0z" fill="#FAFAFA"/><path d="M350 105q110-45 230 0v230q-120-35-230 0z" fill="#BFF36A"/><path d="M350 105v230m-180-180h120m-120 45h120m-120 45h75" stroke="#2E7D32" stroke-linecap="round"/><path d="M394 162h120m-120 45h120m-120 45h70" stroke="#2E7D32" stroke-linecap="round"/></g><g transform="rotate(25 545 210)" stroke="#07140E" stroke-width="5" stroke-linejoin="round"><path d="M530 75h35v225l-18 35-17-35z" fill="#5AD1A0"/><path d="M530 300h35l-18 35z" fill="#FAFAFA"/><path d="M530 100h35m-18 10v175"/></g>'),
    games: svg(die(145,110,-15,"#FAFAFA") + die(400,80,16,"#5AD1A0",true) + '<path d="M120 60l15 24m-60 7l30 8m460 210l15 24m-54 6l27-9" stroke="#2E7D32" stroke-width="7" stroke-linecap="round"/>')
  };
  var css = `<style>
  .social-template{position:relative;overflow:hidden;font-family:'Space Grotesk',sans-serif;color:#07140E;background:#FAFAFA;--social-title:134px;--social-title-room:290px}
  .social-template *{box-sizing:border-box}
  .social-template .social-safe{position:absolute;inset:0;padding:70px 76px 58px;display:flex;flex-direction:column}
  .social-template header{display:flex;justify-content:space-between;align-items:center;gap:24px;flex-shrink:0}
  .social-template .social-logo{display:flex;align-items:center;gap:12px;font-size:40px;font-weight:700;letter-spacing:-1px;white-space:nowrap}
  .social-template .social-logo svg{width:48px;height:48px}
  .social-template [data-field]{display:block;white-space:pre-line;overflow:hidden;overflow-wrap:break-word;min-height:1em;padding-bottom:.3em}
  .social-template .social-tag{font-size:28px;line-height:1.25;max-width:460px;max-height:90px;text-align:right}
  .social-template h2{font-family:'Baloo 2',sans-serif;font-size:var(--social-title);line-height:.98;letter-spacing:-3px;margin:0;font-weight:700;max-height:calc(var(--social-title-room) + .3em)}
  .social-template .social-desc{font-family:'Baloo 2',sans-serif;font-size:42px;line-height:1.18;margin:24px 0 0;max-height:120px}
  .social-template .social-main{margin-top:62px;position:relative;flex:1;min-height:0;display:flex;flex-direction:column}
  .social-template .social-art{flex:1;min-height:80px;max-height:430px;width:100%;margin:10px 0}
  .social-template .social-details{position:relative;flex-shrink:0;display:flex;flex-direction:column;gap:8px;font-size:40px;line-height:1.22;margin-top:auto}
  .social-template .social-details [data-field]{max-height:120px}
  .social-template .social-welcome{font-family:'Baloo 2',sans-serif;font-size:35px;line-height:1.15;max-height:110px;margin:28px 0 0}
  .social-template .social-handle{font-size:24px;line-height:1.2;margin:22px 0 0;max-height:40px}
  .social-template.sober:before{content:'';position:absolute;width:1100px;height:1100px;border-radius:50%;background:#BFF36A;opacity:.25;left:390px;top:480px}
  .social-template.sober h2{color:#0F3322}
  .social-template.sober .social-tag{border-bottom:3px solid #2E7D32;padding-bottom:6px;color:#2E7D32}
  .social-template.sober .social-welcome{align-self:flex-start;background:#BFF36A;padding:15px 24px;border-radius:40px;max-width:100%}
  .social-template.study{background:#5AD1A0}
  .social-template.study .social-main{margin-top:76px}
  .social-template.study .social-heading{position:relative;background:#FAFAFA;padding:34px 40px;transform:rotate(-3deg);box-shadow:10px 12px 0 #0F3322;margin:0 4px 10px}
  .social-template.study .social-heading:before{content:'';position:absolute;top:-24px;left:40%;width:180px;height:48px;background:#BFF36A;transform:rotate(7deg)}
  .social-template.study h2{font-size:122px;max-height:300px}
  .social-template.study .social-desc{font-size:38px;max-height:110px;margin-top:18px}
  .social-template.study .social-details{background:#FAFAFA;padding:24px 32px;transform:rotate(1.5deg);box-shadow:8px 10px 0 #0F3322;margin:0 6px 12px}
  .social-template.study .social-art{max-height:360px;margin:14px 0 12px}
  .social-template.pub{background:#0E5A48;color:#FAFAFA;--social-title:154px;--social-title-room:330px}
  .social-template.pub h2{font-family:'Space Grotesk',sans-serif;color:#FAFAFA;letter-spacing:-5px;line-height:.98}
  .social-template.pub .social-tag{color:#BFF36A}
  .social-template.pub .social-art{margin:28px 0;max-height:400px}
  .social-template.pub .social-welcome{color:#BFF36A;border-top:2px solid #5AD1A0;padding-top:20px}
  .social-template.games{background:#BFF36A;--social-title:150px;--social-title-room:320px}
  .social-template.games .social-tag{color:#07140E}
  .social-template.games .social-art{background:rgba(250,250,250,.45);border-radius:50% 40% 48% 38%;margin:18px 0 26px}
  .social-template.games .social-welcome{border-top:2px solid #2E7D32;padding-top:20px}
  .social-template .social-carousel-wrap{display:flex;justify-content:center;margin-top:22px;flex-shrink:0}
  .social-template .social-carousel{font-size:24px;line-height:1.2;padding:12px 24px;border:2px solid currentColor;border-radius:40px;max-width:100%;max-height:90px}
  .social-template.photo-slide h2{font-size:92px;line-height:1.08;max-height:220px;letter-spacing:-2px}
  .social-template.photo-slide .social-desc{font-size:34px;max-height:100px;margin-top:12px}
  .social-template.photo-slide .social-main{margin-top:40px}
  .social-template .social-photo-grid{position:relative;flex:1;min-height:0;margin:30px 0 24px}
  .social-template .social-photo-grid figure{position:absolute;width:560px;left:12px;top:22px;margin:0;padding:18px;background:#FAFAFA;color:#07140E;border:2px solid #07140E;box-shadow:10px 12px 0 rgba(7,20,14,.2);transform:rotate(-4deg)}
  .social-template .social-photo-grid figure:nth-child(2){width:480px;left:auto;right:12px;top:auto;bottom:18px;transform:rotate(5deg)}
  .social-template .social-photo-grid [data-photo]{width:100%;height:470px;overflow:hidden;background:#F5F5F5;border-radius:6px}
  .social-template .social-photo-grid figure:nth-child(2) [data-photo]{height:400px}
  .social-template .social-photo-grid figcaption{font-family:'Baloo 2',sans-serif;font-size:30px;line-height:1.25;max-height:90px;margin-top:12px}
  .social-template .social-photo-grid .photo-ph{font-size:24px;letter-spacing:0;text-transform:none;color:#2E7D32}
  </style>`;
  function field(key, label, text, cls, tag, multiline) {
    return '<' + (tag || 'div') + ' class="' + (cls || '') + '" data-field="" data-fkey="' + key + '" data-label="' + label + '"' + (multiline ? ' data-multiline=""' : '') + '>' + text + '</' + (tag || 'div') + '>';
  }
  [
    { id: "pub", name: "Pub Social", tag: "Social" },
    { id: "sober", name: "Sober Social", tag: "Social" },
    { id: "study", name: "Study Session", tag: "Study session" },
    { id: "games", name: "Games Night", tag: "Games night" }
  ].forEach(function (theme) {
    var mark = theme.id === 'pub' ? atom : atom.replace(/#BFF36A/g, '#2E7D32').replace(/#FAFAFA/g, '#07140E');
    var heading = '<div class="social-heading">' + field('title', 'Event title', 'Event title', '', 'h2', true) + field('description', 'Caption', 'Caption', 'social-desc', 'p', true) + '</div>';
    var header = '<header><span class="social-logo" data-noedit="">' + mark + '<span>PhySoc.</span></span>' + field('tag', 'Category label', theme.tag, 'social-tag') + '</header>';
    function carousel(text) { return '<div class="social-carousel-wrap">' + field('carousel', 'Carousel prompt', text, 'social-carousel') + '</div>'; }
    templates.push({
      slug: 'social-' + theme.id + '-post', name: theme.name, w: 1080, h: 1350, group: 'Social templates',
      html: '<div class="social-template ' + theme.id + '" data-screen-label="' + theme.name + '" style="width:1080px;height:1350px">' + css +
        '<div class="social-safe">' + header + '<div class="social-main">' + heading +
        '<div class="social-art" data-social-graphic="' + theme.id + '" aria-hidden="true">' + graphics[theme.id] + '</div><div class="social-details">' + field('date', 'Day and time', 'Day · time') + field('location', 'Venue / meeting point', 'Venue or meeting point') + '</div></div>' +
        field('welcome', 'Additional information', 'Additional information', 'social-welcome', 'p', true) + carousel('Swipe for photos →') + field('handle', 'Instagram handle', '@physocluu', 'social-handle') + '</div></div>'
    });
    var photoName = theme.name + ' Photos (slide 2)';
    templates.push({
      slug: 'social-' + theme.id + '-photos', name: photoName, w: 1080, h: 1350, group: 'Social photo slides',
      html: '<div class="social-template photo-slide ' + theme.id + '" data-screen-label="' + photoName + '" style="width:1080px;height:1350px">' + css + '<div class="social-safe">' + header + '<div class="social-main">' + heading +
        '<div class="social-photo-grid"><figure><div data-photo=""></div>' + field('photo1', 'Photo 1 caption', 'Photo 1 caption', '', 'figcaption') + '</figure><figure><div data-photo=""></div>' + field('photo2', 'Photo 2 caption', 'Photo 2 caption', '', 'figcaption') + '</figure></div></div>' +
        carousel('← Back to cover') + field('handle', 'Instagram handle', '@physocluu', 'social-handle') + '</div></div>'
    });
  });
})();
