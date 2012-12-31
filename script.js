(function(window, $, settings, undefined) {

    settings = $.extend({
        // przez ile dni pamiętać ukrycia?
        gcDays: 3,

        // przezroczystość ukrytych artykułów
        // – ustawienie na „0” ukrywa artykuły zupełnie
        // poprawne wartości to [0..1]
        hiddenOpacity: 0
    }, settings);

    /**
     * Obiekt trzymający info o ukrytych artykułach
     */
    var hiddenIds = (function(storage) {
        var articlesStorage = {
            has: function(id) {
                return storage["dnwpHiddenArticle_" + id] ? true : false;
            },
            add: function(id) {
                if (!this.has(id)) {
                    storage["dnwpHiddenArticlesCount"]++;
                }
                storage["dnwpHiddenArticle_" + id] = (new Date()).toJSON();
            },
            remove: function(id) {
                if (this.has(id)) {
                    storage.removeItem("dnwpHiddenArticle_" + id);
                    storage["dnwpHiddenArticlesCount"]--;
                }
            },
            removeOlderThan: function(date) {
                console.log('dnwp removeOlderThan', date);

                for (var key in storage) {
                    // deleting all storage items that are older then "date" arg.
                    // we first check if the key contains info about hidden article id
                    if (   0 === key.indexOf("dnwpHiddenArticle_")
                        && new Date(storage[key]) < date
                    ) {
                        console.log("dnwp removing ", key);

                        storage.removeItem(key);
                        storage["dnwpHiddenArticlesCount"]--;
                    }
                }
            },
            count: function() {
                return window.parseInt(storage["dnwpHiddenArticlesCount"]);
            }
        }

        if (!storage["dnwpHiddenArticlesCount"]) {
            storage["dnwpHiddenArticlesCount"] = 0;
        } else if (storage["dnwpHiddenArticlesCount"] > settings.gcDays * 10 * 54) {
            // gc: delete when more than days * 10 pages * 54 articles
            articlesStorage.removeOlderThan((function() {
                var date = new Date();
                date.setDate(date.getDate() - settings.gcDays);
                console.log(date);
                return date;
            })());
        }

        return articlesStorage;
    }(window.localStorage));


    /**
     * Na starcie ukrywam artykuły już wcześniej ukryte.
     */
    var $articles = $("article.entry[data-id]").each(function() {
        var $article = $(this);
        if (hiddenIds.has($article.attr('data-id'))) {
            if (0 === settings.hiddenOpacity) {
                $article.hide();
            } else {
                $article.fadeTo('fast', settings.hiddenOpacity);
            }
        }
    });


    /**
     * Tworzę przyciski ukrywania artykułu
     */
    var $hideArticleButtons
        = $('<a href="#" class="dnwp_hide_article">ukryj</a>')
            .insertAfter("article.entry header h2 a.link")
            .click(function(e) {
                e.preventDefault();

                var $article = $(this).parents('article.entry');

                if (0 === settings.hiddenOpacity) {
                    $article.slideUp();
                } else {
                    $article.fadeTo('fast', settings.hiddenOpacity);
                }

                hiddenIds.add($article.attr('data-id'));
            });

    /**
     * Tworzę przyciski pokazywania/ukrywania wszystkich artykułów na stronie.
     */
    (function() {
        var $pager = $('.pager');

        $('<a href="#" class="dnwp_buttom_button">pokaż wszystkie</a>')
            .click(function(e) {
                e.preventDefault();
                $articles.fadeTo('fast', 1).each(function() {
                    hiddenIds.remove($(this).attr('data-id'));
                });
            })
            .insertBefore($pager);

        $('<a href="#" class="dnwp_buttom_button dnwp_hide_all">ukryj wszystkie</a>')
            .click(function(e) {
                e.preventDefault();

                $articles.each(function() {
                    hiddenIds.add($(this).attr('data-id'));
                });

                if (0 === settings.hiddenOpacity) {
                    $articles.hide();
                    window.scrollTo(0, 0);
                } else {
                    $articles.fadeTo('fast', settings.hiddenOpacity);
                }
            })
            .insertBefore($pager);
    })();


})(window, $, {
    hiddenOpacity: 0.1
});