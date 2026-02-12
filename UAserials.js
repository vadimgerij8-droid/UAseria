(function() {
    'use strict';

    if (window.uaserials_plugin_loaded) return;
    window.uaserials_plugin_loaded = true;

    var network = new Lampa.Reguest();

    // Додаємо кнопку в бічне меню
    function addMenuButton() {
        var btn = $(
            '<div class="menu__item selector" data-action="uaserials">' +
                '<div class="menu__ico">' +
                    '<svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10z"/></svg>' +
                '</div>' +
                '<div class="menu__text">UASerials UA</div>' +
            '</div>'
        );

        btn.on('hover:enter', function() {
            Lampa.Activity.push({
                url: '',
                title: 'UASerials — українською',
                component: 'uaserials_main',
                page: 1
            });
        });

        $('.menu .menu__list').eq(0).append(btn);
    }

    // Головний компонент з вибором категорії
    Lampa.Component.add('uaserials_main', {
        onCreate: function() {
            this.html = Lampa.Template.get('uaserials_categories', {}, true);
        },

        onRender: function() {
            var items = [
                {title: 'Новинки', cat: 'home'},
                {title: 'Серіали',  cat: 'serials'},
                {title: 'Фільми',   cat: 'films'},
                {title: 'Аніме',    cat: 'anime'},
                {title: 'Мультфільми', cat: 'cartoon'}
            ];

            items.forEach(item => {
                var btn = $('<div class="selector">'+item.title+'</div>');
                btn.on('hover:enter', () => {
                    Lampa.Activity.push({
                        url: '',
                        title: item.title,
                        component: 'uaserials_list',
                        category: item.cat,
                        page: 1
                    });
                });
                this.append(btn);
            });

            this.selectorSet(items[0]);
        }
    });

    // Компонент зі списком контенту
    Lampa.Component.add('uaserials_list', {
        category: 'home',
        page: 1,

        onCreate: function() {
            this.activity.loader(true);
            this.scroll = new Lampa.Scroll({mask:true, over:true, step:250});
            this.html.find('.activity__content').append(this.scroll.render());
        },

        onEnter: function() {
            this.load();
        },

        load: function() {
            var self = this;
            self.activity.loader(true);

            var base = 'https://uaserials.com/';
            var url = base;

            if (this.category === 'serials')  url += 'serials/';
            else if (this.category === 'films')   url += 'films/';
            else if (this.category === 'anime')   url += 'anime/';
            else if (this.category === 'cartoon') url += 'cartoon/';
            // home — залишаємо головну

            if (this.page > 1) url += 'page/' + this.page + '/';

            network.silent(url, function(html) {
                var doc = $(html.replace(/src\s*=\s*["']\/\//g, 'src="https://').replace(/href\s*=\s*["']\/\//g, 'href="https://'));

                var cards = [];

                // Більш широкий набір селекторів — те, що найчастіше зустрічається на подібних сайтах
                var selectors = [
                    '.serial-item', '.movie-item', '.item', '.card', 
                    '.poster', '.film-poster', '.content-item', 
                    '[class*="poster"]', '[class*="card"]', '[class*="item"]'
                ];

                var found = false;
                selectors.some(sel => {
                    var elements = doc.find(sel);
                    if (elements.length > 2) {
                        elements.each(function() {
                            var el = $(this);

                            var a     = el.find('a').first();
                            var href  = a.attr('href') || '';
                            if (!href) return;

                            if (!href.startsWith('http')) href = base + href.replace(/^\//, '');

                            var img   = el.find('img').first().attr('src') || el.find('img').first().attr('data-src') || '';
                            if (img && !img.startsWith('http')) img = 'https:' + img;

                            var title = (el.find('h3, .title, .name, .film-name, [class*="title"], [class*="name"]').first().text() || '').trim();
                            if (!title) title = a.text().trim() || 'Без назви';

                            var subtitle = (el.find('.year, .info, .season, .episode, [class*="year"], [class*="info"]').first().text() || '').trim();

                            if (href && title) {
                                var card = Lampa.Card({
                                    title: title,
                                    img: img,
                                    subtitle: subtitle || 'UASerials',
                                    vote_average: 0,
                                    data: { url: href }
                                });

                                card.on('click', function() {
                                    // Найпростіше — відкрити сторінку
                                    Lampa.Browser.open(href);

                                    // Якщо хочете спробувати знайти плеєр автоматично — розкоментуйте нижче
                                    // self.openItemPage(href);
                                });

                                cards.push(card);
                            }
                        });
                        found = true;
                        return true;
                    }
                });

                if (!found || cards.length === 0) {
                    Lampa.Noty.show('Не знайдено карток контенту на сторінці');
                }

                self.scroll.append(cards);
                self.scroll.update(cards);

                // Додаємо кнопку "Наступна сторінка"
                if (cards.length >= 8) {  // ймовірно є ще контент
                    var next = $('<div class="button selector">Наступна сторінка</div>');
                    next.on('hover:enter', () => {
                        self.page++;
                        self.activity.loader(true);
                        self.load();
                    });
                    self.scroll.append(next);
                }

                self.activity.loader(false);
            }, function() {
                Lampa.Noty.show('Помилка завантаження UASerials');
                self.activity.loader(false);
            });
        },

        // Опціонально — спроба відкрити сторінку тайтла і знайти плеєр (дуже крихко!)
        openItemPage: function(url) {
            network.silent(url, html => {
                var doc = $(html);
                // Типові плеєри /watch/, /online/, /player/, tortuga, calypso тощо
                var playerLink = doc.find('a[href*="watch"], a[href*="online"], a[href*="player"], a[href*="tortuga"], a[href*="calypso"]').first().attr('href') || '';
                if (playerLink) {
                    if (!playerLink.startsWith('http')) playerLink = 'https://uaserials.com' + playerLink;
                    Lampa.Browser.open(playerLink);
                } else {
                    Lampa.Browser.open(url);
                }
            }, () => {
                Lampa.Browser.open(url);
            });
        }
    });

    // Додаємо іконку та пункт в налаштування
    if (!window.lampa_settings.uaserials) {
        Lampa.SettingsApi.addComponent({
            component: 'uaserials',
            icon: '<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/></svg>',
            name: 'UASerials UA'
        });

        Lampa.SettingsApi.addParam({
            component: 'uaserials',
            field: { name: 'Джерело', description: 'UASerials https://uaserials.com' },
            param: { type: 'title' }
        });

        Lampa.SettingsApi.addParam({
            component: 'uaserials',
            field: { name: 'Відкрити сайт' },
            param: { type: 'button' },
            onChange: () => Lampa.Browser.open('https://uaserials.com')
        });
    }

    // Запуск
    function startPlugin() {
        if (window.appready) {
            addMenuButton();
        } else {
            Lampa.Listener.follow('app', e => {
                if (e.type === 'ready') addMenuButton();
            });
        }
    }

    startPlugin();

})();
