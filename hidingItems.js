(function(window, $, settings, undefined) {

    var console = window.console;

    settings = $.extend({
        // przez ile dni pamiętać ukrycia?
        gcDays: 7,

        // czy automatycznie ukrywać artykuł, który został właśnie otworzony?
        hideWhenOpened: false,

        // czy wywalić oryginalny przycisk ukrywania w poczekalni?
        removeOriginalHideButton: false,

        // przezroczystość ukrytych artykułów
        // – ustawienie na „0” ukrywa artykuły zupełnie
        // poprawne wartości to [0..1]
        hiddenOpacity: 0.2,

        // czy sortować znaleziska tak, żeby widoczne były pierwsze?
        visibleFirst: true,

        // co robić z Wykop Poleca?
        // „null”:     mają być traktowane jak zwykłe znaleziska
        // „'hide'”:   domyślnie mają być ukrywane
        // „'remove'”: mają być w ogóle usuwane z widoku
        wykopPoleca: null,

        // co robić ze sponsorowanymi? j.w.
        sponsorowane: null,

        // co robić z linkami z Wykop Marketu? j.w.
        wykopMarket: null
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


    /**
     * Pokazywanie/ukrywanie artykułów w widoku
     */
    var itemsViewFunctions = {
        hideOne: function($el) {
            if (0 === settings.hiddenOpacity) {
                $el.slideUp();
                lazyLoad();
            } else {
                $el.fadeTo('fast', settings.hiddenOpacity);
            }

            $el.addClass('dnwpHidden');

            $el.find('.dnwpShowHideItem').text('pokaż');
        },
        showOne: function($el) {
            $el.fadeTo('fast', 1).removeClass('dnwpHidden');

            $el.find('.dnwpShowHideItem').text('ukryj');
        },
        hideMany: function($el) {
            if (0 === settings.hiddenOpacity) {
                $el.hide();
                lazyLoad();
            } else {
                $el.fadeTo('fast', settings.hiddenOpacity);
            }

            $el.addClass('dnwpHidden');

            $el.find('.dnwpShowHideItem').text('pokaż');
        },
        showMany: function($el) {
            $el.fadeTo('fast', 1).removeClass('dnwpHidden');

            if (0 === settings.hiddenOpacity) {
                lazyLoad();
            }

            $el.find('.dnwpShowHideItem').text('ukryj');
        }
    };


    /**
     * Obiekt trzymający info o ukrytych artykułach
     * Klucze zaczynają się prefixem, żeby uniknąć kolizji oraz ułatwić wyszukiwanie.
     * W kluczu trzymane jest ID znaleziska, w wartości data ukrycia.
     */
    var hiddenItemsStorage = (function(storage, prefix) {
        var countKey = "_" + prefix + "_count";

        var hiddenItemsStorage = {
            has: function(id) {
                if (!id) {
                    return false;
                }

                return storage[prefix + id] ? true : false;
            },
            add: function(id) {
                if (!id) {
                    return false;
                }

                if (!this.has(id)) {
                    storage[countKey]++;
                }

                storage[prefix + id] = (new Date()).toJSON();

                return true;
            },
            remove: function(id) {
                if (!id) {
                    return false;
                }

                if (this.has(id)) {
                    storage.removeItem(prefix + id);
                    storage[countKey]--;

                    return true;
                }

                return false;
            },
            removeOlderThan: function(date) {
                console.log('dnwp removeOlderThan', date);

                var beforeCount = storage[countKey];

                // deleting all storage items that are older then "date" arg.
                // takes only dnwp keys into account (filters thx to the prefix)
                for (var key in storage) {
                    if (   0 === key.indexOf(prefix)     // has the prefix
                        && new Date(storage[key]) < date // is old enough
                    ) {
                        console.log("dnwp removing ", key);

                        storage.removeItem(key);
                        storage[countKey]--;
                    }
                }

                return beforeCount - storage[countKey];
            },
            count: function() {
                return window.parseInt(storage[countKey]);
            },
            clear: function() {
                return this.removeOlderThan(new Date());
            }
        }

        // gc: automatically delete when more than: days * 10 pages * 54 articles per page
        if (!storage[countKey]) {
            storage[countKey] = 0;
        } else if (storage[countKey] > settings.gcDays * 540) {
            console.log('dnwp gc: removed ' + hiddenItemsStorage.removeOlderThan((function() {
                var date = new Date();
                date.setDate(date.getDate() - settings.gcDays);
                return date;
            })()) + 'items');
        }

        return hiddenItemsStorage;
    }(window.localStorage, 'dnwpHiddenItem_'));


    /**
     * Wyszukuję znaleziska
     */
    var $items = $('article.entry');


    /**
     * Funkcja wyciągająca napis identyfikujący artykuł, żeby móc nim zarządzać.
     */
    var identifyItem = function($item) {
        if ($item.attr('data-id')) {
            return $item.attr('data-id');
        }

        if ($item.hasClass('sponsoredby')) {
            return $item.find('a.diggbox').attr('href').replace(/.*(paylink.*)/, "$1");
        }

        if ($item.hasClass('newmarket')) {
            // wyciągam ID regexpem z linka do znaleziska
            return $item.find('.diggbox a').attr('href').replace(/.*link\/(\d+)\/.*/, "$1");
        }

        console.error('identifyItem() nie zidentyfikował artykułu!', $item);

        return null;
    };


    /**
     * Tworzę przyciski ukrywania artykułu
     */
    $('<a href="#" class="dnwpShowHideItem">ukryj</a>')
        .insertAfter($items.find('header h2 a.link'))
        .click(function(e) {
            e.preventDefault();

            var $button = $(this);
            var $item = $button.parents('article.entry');

            if ($item.hasClass('dnwpHidden')) {
                // pokazujemy artykuł
                itemsViewFunctions.showOne($item);
                hiddenItemsStorage.remove(identifyItem($item));
            } else {
                // ukrywamy artykuł
                itemsViewFunctions.hideOne($item);
                hiddenItemsStorage.add(identifyItem($item));
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
     * Na starcie ukrywam artykuły ukryte w poprzednich requestach do strony
     */
    itemsViewFunctions.hideMany($items.filter(function() {
        return hiddenItemsStorage.has(identifyItem($(this)));
    }));


    /**
     * Ukrywanie/usuwanie znalezisk z Wykop Poleca, Wykop Marketu i sponsorowanych
     */
    $.each({
        wykopPoleca:  ':has(.content a[href="http://www.wykop.pl/reklama/"])',
        wykopMarket:  '.newmarket',
        sponsorowane: '.sponsoredby'
    }, function(name, filter) {
        var setting = settings[name];
        if (setting) {
            var $itemsFiltered = $items.filter(filter);

            switch (setting) {
                case 'hide':
                    itemsViewFunctions.hideMany($itemsFiltered);
                    break;

                case 'remove':
                    $itemsFiltered.hide();
                    lazyLoad();
                    break;
            }
        }
    });


    /**
     * Sortowanie wg widoczności
     * i doklejenie paginatora przed pierwszym niewidocznym
     */
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


    /**
     * Ukrywanie wykopowego przycisku ukrywania w poczeklani
     */
    if (settings.removeOriginalHideButton) {
        $items.find('a.closelist').remove();
    }


    /**
     * Ukrywanie artykułów po ich otwarciu.
     * Przechwytuje kliknięcia na tytuły i przycisk komentarzy.
     */
    if (settings.hideWhenOpened) {
        $items.find('.content header').find('h2 a:not(.dnwpShowHideItem), p a:has(.comments)').click(function() {
            var $item = $(this).parents('article.entry');
            itemsViewFunctions.hideOne($item);
            hiddenItemsStorage.add(identifyItem($item));
        });
    }

})(window, $, {
    removeOriginalHideButton: true,
    hideWhenOpened: true
});