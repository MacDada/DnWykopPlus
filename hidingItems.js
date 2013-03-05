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


    // do dokumentu dorzucam funkcję inicjalizującą przeładowywanie miniaturek
    (function() {
        var initLazy = function($, window) {
            var $window = $(window);
            var $lazy = $('div.lazy');

            window.dnwpLoadLazy = function() {
                $lazy.lazyLoad();
                $window.trigger('scroll');
            };
        };

        var script = window.document.createElement("script");
        script.text = '(' + initLazy.toString() + ')($, window);';
        window.document.body.appendChild(script);
    })();

    // funkcja przeładowująca miniaturki do artykułów
    var lazyLoad = function() {
        var script = window.document.createElement("script");
        script.text = "dnwpLoadLazy();";
        window.document.body.appendChild(script);
    };


    var itemsViewFunctions = {
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
    var hiddenItemsStorage = (function(storage) {
        var prefix = "dnwpHiddenItem_";

        var hiddenItemsStorage = {
            has: function(id) {
                return storage[prefix + id] ? true : false;
            },
            add: function(id) {
                if (!this.has(id)) {
                    storage["dnwpHiddenItemsCount"]++;
                }
                storage[prefix + id] = (new Date()).toJSON();
            },
            remove: function(id) {
                if (this.has(id)) {
                    storage.removeItem(prefix + id);
                    storage["dnwpHiddenItemsCount"]--;
                }
            },
            removeOlderThan: function(date) {
                console.log('dnwp removeOlderThan', date);

                var beforeCount = storage["dnwpHiddenItemsCount"];

                // deleting all storage items that are older then "date" arg.
                // takes only dnwp keys into account (filters thx to the prefix)
                for (var key in storage) {
                    if (   0 === key.indexOf(prefix)     // has the prefix
                        && new Date(storage[key]) < date // is old enough
                    ) {
                        console.log("dnwp removing ", key);

                        storage.removeItem(key);
                        storage["dnwpHiddenItemsCount"]--;
                    }
                }

                return beforeCount - storage["dnwpHiddenItemsCount"];
            },
            count: function() {
                return window.parseInt(storage["dnwpHiddenItemsCount"]);
            }
        }

        // gc: automatically delete when more than: days * 10 pages * 54 articles per page
        if (!storage["dnwpHiddenItemsCount"]) {
            storage["dnwpHiddenItemsCount"] = 0;
        } else if (storage["dnwpHiddenItemsCount"] > settings.gcDays * 540) {
            console.log('dnwp gc: removed ' + hiddenItemsStorage.removeOlderThan((function() {
                var date = new Date();
                date.setDate(date.getDate() - settings.gcDays);
                return date;
            })()) + 'items');
        }

        return hiddenItemsStorage;
    }(window.localStorage));


    /**
     * Wyszukuję znaleziska
     */
    var $items = $("article.entry[data-id]");


    /**
     * Tworzę przyciski ukrywania artykułu
     */
    $('<a href="#" class="dnwpShowHideItem">ukryj</a>')
        .insertAfter("header h2 a.link", $items)
        .click(function(e) {
            e.preventDefault();
            var $this = $(this);
            var $item = $this.parents('article.entry');

            if ($this.hasClass('show')) {
                itemsViewFunctions.showOne($item);
                hiddenItemsStorage.remove($item.attr('data-id'));
                $this.removeClass('show');
            } else {
                itemsViewFunctions.hideOne($item);
                hiddenItemsStorage.add($item.attr('data-id'));
                $this.addClass('show');
            }
        });

    /**
     * Tworzę przyciski pokazywania/ukrywania wszystkich artykułów na stronie.
     */
    var $pager = $('.pager');

    var $showAll = $('<a href="#" class="dnwpButtomButton">pokaż wszystkie</a>')
        .click(function(e) {
            e.preventDefault();

            itemsViewFunctions.showMany($items);

            $items.each(function() {
                hiddenItemsStorage.remove($(this).attr('data-id'));
            });
        })
        .insertBefore($pager);

    var $hideAll = $('<a href="#" class="dnwpButtomButton dnwpHideAll">ukryj wszystkie</a>')
        .click(function(e) {
            e.preventDefault();

            itemsViewFunctions.hideMany($items);

            if (0 === settings.hiddenOpacity) {
                window.scrollTo(0, 0);
            }

            $items.each(function() {
                hiddenItemsStorage.add($(this).attr('data-id'));
            });
        })
        .insertBefore($pager);


    /**
     * Na starcie ukrywam artykuły już wcześniej ukryte.
     */
    itemsViewFunctions.hideMany($items.filter(function() {
        return hiddenItemsStorage.has($(this).attr('data-id'));
    }));


    // sortowanie wg widoczności i doklejenie paginatora przed pierwszym niewidocznym
    if (settings.visibleFirst && settings.hiddenOpacity > 0) {
        $items.sortElements(function(a, b) {
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