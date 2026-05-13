
var UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var DEFAULT_SITE = 'https://www.netflixgc.net';

var cfg = { site: DEFAULT_SITE, homeClass: [] };

function normalizeHomeClass(arr) {
  if (!arr || !Array.isArray(arr)) return [];
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i];
    if (!it || typeof it !== 'object') continue;
    var id =
      it.type_id != null
        ? String(it.type_id)
        : it.id != null
          ? String(it.id)
          : '';
    if (!id) continue;
    var nm =
      it.type_name != null
        ? String(it.type_name)
        : it.name != null
          ? String(it.name)
          : '';
    out.push({ type_id: id, type_name: nm || id });
  }
  return out;
}

function init(extend) {
  cfg.site = DEFAULT_SITE;
  cfg.homeClass = [];
  if (typeof extend === 'string' && extend) {
    try {
      var j = JSON.parse(extend);
      if (j && j.site) cfg.site = String(j.site).replace(/\/+$/, '');
      cfg.homeClass = normalizeHomeClass(j && j.homeClass);
    } catch (e0) {}
  } else if (extend && typeof extend === 'object') {
    if (extend.site) cfg.site = String(extend.site).replace(/\/+$/, '');
    cfg.homeClass = normalizeHomeClass(extend.homeClass);
  }
}

function site() {
  return cfg.site || DEFAULT_SITE;
}

function absUrl(path) {
  if (!path) return '';
  var p = String(path).trim();
  if (!p) return '';
  if (p.indexOf('http://') === 0 || p.indexOf('https://') === 0) return p;
  if (p.charAt(0) === '/') return site() + p;
  return site() + '/' + p;
}

function httpJsonPost(formData, referer) {
  var ref = referer && String(referer).length ? String(referer) : site() + '/';
  var res = req(site() + '/index.php/ds_api/vod', {
    method: 'post',
    postType: 'form',
    data: formData,
    headers: {
      'User-Agent': UA,
      Referer: ref,
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json, text/javascript, */*; q=0.01',
    },
    timeout: 20000,
    redirect: 1,
  });
  return res && res.content ? String(res.content) : '';
}

function httpGet(pathOrUrl) {
  var url = pathOrUrl.indexOf('http') === 0 ? pathOrUrl : absUrl(pathOrUrl);
  var res = req(url, {
    method: 'get',
    headers: {
      'User-Agent': UA,
      Referer: site() + '/',
      Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    },
    timeout: 25000,
    redirect: 1,
  });
  return res && res.content ? String(res.content) : '';
}

function httpSuggest(wd, limit) {
  var lim = limit && Number(limit) > 0 ? Number(limit) : 80;
  var url =
    site() +
    '/index.php/ajax/suggest?mid=1&limit=' +
    lim +
    '&wd=' +
    encodeURIComponent(String(wd || '').trim());
  var res = req(url, {
    method: 'get',
    headers: {
      'User-Agent': UA,
      Referer: site() + '/vodsearch/-------------.html',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
    },
    timeout: 20000,
    redirect: 1,
  });
  return res && res.content ? String(res.content) : '';
}

function stripTags(s) {
  return String(s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickExt(extend, key) {
  if (!extend) return '';
  try {
    var v = extend[key];
    if (v === undefined || v === null) return '';
    return String(v);
  } catch (e) {
    return '';
  }
}

function vodListForm(tid, page, extend) {
  return {
    type: String(tid),
    class: pickExt(extend, 'class'),
    area: pickExt(extend, 'area'),
    year: pickExt(extend, 'year'),
    lang: pickExt(extend, 'lang'),
    version: pickExt(extend, 'version'),
    state: pickExt(extend, 'state'),
    letter: pickExt(extend, 'letter'),
    time: pickExt(extend, 'time'),
    level: pickExt(extend, 'level') || '0',
    weekday: pickExt(extend, 'weekday'),
    by: pickExt(extend, 'by') || 'time',
    page: String(page || '1'),
  };
}

function parseClassFromHomeHtml(html) {
  var h = String(html || '');
  if (h.indexOf('vodshow/') < 0) return [];
  var out = [];
  var seen = {};
  var re = /href=["']\/vodshow\/(\d+)-----------\.html["'][^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  while ((m = re.exec(h)) !== null) {
    var tid = m[1];
    if (seen[tid]) continue;
    var inner = m[2] || '';
    var titleM = inner.match(/<p class="time-title">([^<]*)<\/p>/i);
    var name = titleM
      ? stripTags(titleM[1]).trim()
      : stripTags(inner).replace(/\s+/g, ' ').trim();
    if (!name || name === '首页') continue;
    seen[tid] = true;
    out.push({ type_id: tid, type_name: name });
  }
  return out;
}

function home(filter) {
  var html = httpGet('/');
  var klass = parseClassFromHomeHtml(html);
  if (!klass.length && cfg.homeClass && cfg.homeClass.length) klass = cfg.homeClass;
  return JSON.stringify({ class: klass });
}

function category(tid, pg, filter, extend) {
  var raw = httpJsonPost(vodListForm(tid, pg, extend));
  return raw || '{"code":0,"list":[],"pagecount":0}';
}

function normVodId(id) {
  var s = String(id || '').trim();
  var m =
    s.match(/detail[\/\\](\d+)/i) ||
    s.match(/[\/\\](\d+)\.html/i) ||
    s.match(/^(\d+)$/);
  return m ? m[1] : s;
}

function extractAnthology(html) {
  var idx = html.indexOf('class="anthology wow');
  if (idx < 0) return { tabNames: [], lines: [] };
  var end = html.indexOf('$(".anthology-tab a").eq(0)', idx);
  var block = end > idx ? html.substring(idx, end) : html.substring(idx);

  var tabNames = [];
  var tabPart = block.match(
    /<div class="anthology-tab[^>]*>([\s\S]*?)<\/div>\s*<div class="anthology-list/,
  );
  if (tabPart) {
    var th = tabPart[1];
    var rTab = /<a class="swiper-slide[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    var mt;
    while ((mt = rTab.exec(th)) !== null) {
      var nm = stripTags(mt[1]).replace(/\s+/g, ' ').trim();
      if (!nm) nm = '线路' + (tabNames.length + 1);
      tabNames.push(nm);
    }
  }

  var lines = [];
  var rBox =
    /<div class="anthology-list-box[^>]*>\s*<div>([\s\S]*?)<\/div>\s*<\/div>/g;
  var mb;
  while ((mb = rBox.exec(block)) !== null) {
    var sub = mb[1];
    var eps = [];
    var rA =
      /<a[^>]*class="[^"]*this-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    var ma;
    while ((ma = rA.exec(sub)) !== null) {
      var href = ma[1];
      if (!href || href.indexOf('/play/') !== 0) continue;
      var label = stripTags(ma[2]).trim() || '播放';
      eps.push(label + '$' + absUrl(href));
    }
    if (eps.length) lines.push(eps.join('#'));
  }

  return { tabNames: tabNames, lines: lines };
}

function extractTitle(html) {
  var m = html.match(/<h3 class="slide-info-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
  if (m) return stripTags(m[1]);
  m = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
  return m ? m[1].trim() : '';
}

function extractPic(html) {
  var m = html.match(/<div class="detail-pic">[\s\S]*?data-src="([^"]+)"/i);
  return m ? m[1].trim() : '';
}

function extractYear(html) {
  var m = html.match(
    /<a class="deployment[^"]*"[^>]*>[\s\S]*?<span>(\d{4})<\/span>/i,
  );
  if (m) return m[1];
  m = html.match(/vodsearch\/[^"']*-{5,}(\d{4})[^"']*\.html/i);
  return m ? m[1] : '';
}

function extractIntro(html) {
  var m = html.match(/id="height_limit"[^>]*>([\s\S]*?)<\/div>/i);
  return m ? stripTags(m[1]) : '';
}

function detail(id) {
  var vid = normVodId(id);
  var html = httpGet('/detail/' + vid + '.html');
  if (!html || html.indexOf('anthology-list-box') < 0) {
    return JSON.stringify({
      list: [
        {
          vod_id: vid,
          vod_name: '',
          vod_pic: '',
          vod_play_from: '',
          vod_play_url: '',
          vod_year: '',
          vod_content: '详情页无播放列表或请求失败（检查网络/站点）',
        },
      ],
    });
  }

  var anth = extractAnthology(html);
  var tabNames = anth.tabNames;
  var lines = anth.lines;
  if (!lines.length) {
    return JSON.stringify({
      list: [
        {
          vod_id: vid,
          vod_name: extractTitle(html),
          vod_pic: extractPic(html),
          vod_play_from: '',
          vod_play_url: '',
          vod_year: extractYear(html),
          vod_content: extractIntro(html),
        },
      ],
    });
  }

  while (tabNames.length < lines.length) {
    tabNames.push('线路' + tabNames.length);
  }
  while (tabNames.length > lines.length) {
    tabNames.pop();
  }

  return JSON.stringify({
    list: [
      {
        vod_id: vid,
        vod_name: extractTitle(html),
        vod_pic: extractPic(html),
        vod_play_from: tabNames.join('$$$'),
        vod_play_url: lines.join('$$$'),
        vod_year: extractYear(html),
        vod_content: extractIntro(html),
      },
    ],
  });
}

function search(key, quick, pg) {
  var wd = String(key || '').trim();
  if (!wd) return JSON.stringify({ list: [] });
  var raw = httpSuggest(wd, 80);
  if (!raw || raw.indexOf('"list"') < 0) return JSON.stringify({ list: [] });
  return raw;
}

function play(flag, id, vipFlags) {
  var url = absUrl(id);
  return JSON.stringify({
    parse: 1,
    jx: 0,
    url: url,
    playUrl: '',
    flag: String(flag || ''),
  });
}

export default function () {
  return {
    init: init,
    home: home,
    category: category,
    detail: detail,
    search: search,
    play: play,
    sniffer: function () {
      return false;
    },
    isVideo: function (u) {
      if (!u) return false;
      return /\.(m3u8|mp4|flv|mkv|ts)(\?|$)/i.test(String(u));
    },
  };
}
