(function(window, $, settings, undefined) {

    var console = window.console;

    settings = $.extend({
        // przez ile dni pamiętać ukrycia?
        gcDays: 7,

        // przezroczystość ukrytych artykułów
        // – ustawienie na „0” ukrywa artykuły zupełnie
        // poprawne wartości to [0..1]
        hiddenOpacity: 0,

        // czy sortować znaleziska tak, żeby widoczne były pierwsze?
        visibleFirst: true
    }, settings);


    // do dokumentu dorzucam funkcję inicjalizującą przeładowywanie obrazków
    (function() {
        var initLazy = function($, window) {
            var $window = $(window);
            var $lazy = $('div.lazy');

            window.dnwpReloadLazy = function() {
                $lazy.lazyLoad();
                $window.trigger('scroll');
            };
        };

        var script = window.document.createElement("script");
        script.text = '(' + initLazy.toString() + ')($, window);';
        window.document.body.appendChild(script);
    })();

    // funkcja przeładowująca obrazki
    var lazyLoad = function() {
        var script = window.document.createElement("script");
        script.text = "dnwpReloadLazy();";
        window.document.body.appendChild(script);
    };


    var view = {
        hideOne: function($el) {
            if (0 === settings.hiddenOpacity) {
                $el.slideUp();
                lazyLoad();
            } else {
                $el.fadeTo('fast', settings.hiddenOpacity);
            }

            $el.addClass('dnwpHidden');
        },
        showOne: function($el) {
            $el.fadeTo('fast', 1).removeClass('dnwpHidden');
        },
        hideMany: function($el) {
            if (0 === settings.hiddenOpacity) {
                $el.hide();
                lazyLoad();
            } else {
                $el.fadeTo('fast', settings.hiddenOpacity);
                $el.find()
            }

            $el.addClass('dnwpHidden');
        },
        showMany: function($el) {
            $el.fadeTo('fast', 1).removeClass('dnwpHidden');

            if (0 === settings.hiddenOpacity) {
                lazyLoad();
            }
        }
    };


    /**
     * Obiekt trzymający info o ukrytych artykułach
     * Klucze zaczynają się prefixem, żeby uniknąć kolizji oraz ułatwić wyszukiwanie.
     * W kluczu trzymane jest ID znaleziska, w wartości data ukrycia.
     */
    var hiddenIds = (function(storage) {
        var prefix = "dnwpHiddenArticle_";

        var hiddenItems = {
            has: function(id) {
                return storage[prefix + id] ? true : false;
            },
            add: function(id) {
                if (!this.has(id)) {
                    storage["dnwpHiddenArticlesCount"]++;
                }
                storage[prefix + id] = (new Date()).toJSON();
            },
            remove: function(id) {
                if (this.has(id)) {
                    storage.removeItem(prefix + id);
                    storage["dnwpHiddenArticlesCount"]--;
                }
            },
            removeOlderThan: function(date) {
                console.log('dnwp removeOlderThan', date);

                var beforeCount = storage["dnwpHiddenArticlesCount"];

                // deleting all storage items that are older then "date" arg.
                // takes only dnwp keys into account (filters thx to the prefix)
                for (var key in storage) {
                    if (   0 === key.indexOf(prefix)     // has the prefix
                        && new Date(storage[key]) < date // is old enough
                    ) {
                        console.log("dnwp removing ", key);

                        storage.removeItem(key);
                        storage["dnwpHiddenArticlesCount"]--;
                    }
                }

                return beforeCount - storage["dnwpHiddenArticlesCount"];
            },
            count: function() {
                return window.parseInt(storage["dnwpHiddenArticlesCount"]);
            }
        }

        // gc: automatically delete when more than: days * 10 pages * 54 articles per page
        if (!storage["dnwpHiddenArticlesCount"]) {
            storage["dnwpHiddenArticlesCount"] = 0;
        } else if (storage["dnwpHiddenArticlesCount"] > settings.gcDays * 540) {
            console.log('dnwp gc: removed ' + hiddenItems.removeOlderThan((function() {
                var date = new Date();
                date.setDate(date.getDate() - settings.gcDays);
                return date;
            })()) + 'items');
        }

        return hiddenItems;
    }(window.localStorage));


    /**
     * Wyszukuję znaleziska
     */
    var $articles = $("article.entry[data-id]");


    /**
     * Tworzę przyciski ukrywania artykułu
     */
    $('<a href="#" class="dnwpShowHideArticle">ukryj</a>')
        .insertAfter("header h2 a.link", $articles)
        .click(function(e) {
            e.preventDefault();
            var $this = $(this);
            var $article = $this.parents('article.entry');

            if ($this.hasClass('show')) {
                view.showOne($article);
                hiddenIds.remove($article.attr('data-id'));
                $this.removeClass('show');
            } else {
                view.hideOne($article);
                hiddenIds.add($article.attr('data-id'));
                $this.addClass('show');
            }
        });

    /**
     * Tworzę przyciski pokazywania/ukrywania wszystkich artykułów na stronie.
     */
    var $pager = $('.pager');

    var $showAll = $('<a href="#" class="dnwp_buttom_button">pokaż wszystkie</a>')
        .click(function(e) {
            e.preventDefault();

            view.showMany($articles);

            $articles.each(function() {
                hiddenIds.remove($(this).attr('data-id'));
            });
        })
        .insertBefore($pager);

    var $hideAll = $('<a href="#" class="dnwp_buttom_button dnwp_hide_all">ukryj wszystkie</a>')
        .click(function(e) {
            e.preventDefault();

            view.hideMany($articles);

            if (0 === settings.hiddenOpacity) {
                window.scrollTo(0, 0);
            }

            $articles.each(function() {
                hiddenIds.add($(this).attr('data-id'));
            });
        })
        .insertBefore($pager);


    /**
     * Na starcie ukrywam artykuły już wcześniej ukryte.
     */
    view.hideMany($articles.filter(function() {
        return hiddenIds.has($(this).attr('data-id'));
    }));


    // sortowanie wg widoczności i doklejenie paginatora przed pierwszym niewidocznym
    if (settings.visibleFirst && settings.hiddenOpacity > 0) {
        $articles.sortElements(function(a, b) {
            return $(a).hasClass('dnwpHidden') ? 1 : -1;
        });

        $('article.entry[data-id]')
            .filter('.dnwpHidden:first')
            .before($showAll.clone(true))
            .before($hideAll.clone(true))
            .before($pager.clone(true));

        lazyLoad();
    }

})(window, $, {
    hiddenOpacity: 0.2
});