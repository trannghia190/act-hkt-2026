/* Mockup kit — chèn thanh chọn 3 theme + 2 khổ, không cần sửa từng file màn.
   Dùng: <div id="stage" data-theme="midnight-rail" data-vp="desktop">…</div>
   Tên màn lấy từ <body data-title="Chấm công">. */
(function () {
  var stage = document.getElementById('stage');
  if (!stage) return;

  var THEMES = [
    ['ascend-clean', 'Ascend Clean'],
    ['midnight-rail', 'Midnight Rail'],
    ['bento-studio', 'Bento Studio'],
  ];
  var VPS = [
    ['desktop', 'Desktop 1440'],
    ['mobile', 'Mobile 390'],
  ];

  stage.dataset.theme = stage.dataset.theme || 'midnight-rail';
  stage.dataset.vp = stage.dataset.vp || 'desktop';

  var bar = document.createElement('div');
  bar.className = 'kit-bar';

  var title = document.createElement('span');
  title.className = 'title';
  title.textContent = document.body.dataset.title || document.title || 'Mockup';
  bar.appendChild(title);

  function group(label, items, attr, apply) {
    var g = document.createElement('div');
    g.className = 'grp';
    var l = document.createElement('span');
    l.className = 'lbl';
    l.textContent = label;
    g.appendChild(l);
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = it[1];
      b.dataset[attr] = it[0];
      b.addEventListener('click', function () {
        apply(it[0]);
        sync();
      });
      g.appendChild(b);
    });
    return g;
  }

  function sync() {
    bar.querySelectorAll('[data-kit-theme]').forEach(function (b) {
      b.dataset.active = String(b.dataset.kitTheme === stage.dataset.theme);
    });
    bar.querySelectorAll('[data-kit-vp]').forEach(function (b) {
      b.dataset.active = String(b.dataset.kitVp === stage.dataset.vp);
    });
  }

  bar.appendChild(
    group('Theme', THEMES, 'kitTheme', function (v) {
      stage.dataset.theme = v;
    }),
  );
  bar.appendChild(
    group('Khổ', VPS, 'kitVp', function (v) {
      stage.dataset.vp = v;
    }),
  );
  sync();

  document.body.insertBefore(bar, document.body.firstChild);
})();
