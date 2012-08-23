/*
 * jQuery Foundation Joyride Plugin 2.0
 * http://foundation.zurb.com
 * Copyright 2012, ZURB
 * Free to use under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
*/

/*jslint unparam: true, browser: true, indent: 2 */

// TODO: test IE 8, hook up jQuery 1.7 detection, class targeting, skip functionality, more mobile testing

;(function ($, window, document, undefined) {
  'use strict';

  var settings = {
    'tipLocation'          : 'bottom',  // 'top' or 'bottom' in relation to parent
    'nubPosition'          : 'auto',    // override on a per tooltip bases 
    'scrollSpeed'          : 300,       // Page scrolling speed in milliseconds
    'timer'                : 0,         // 0 = no timer , all other numbers = timer in milliseconds
    'startTimerOnClick'    : true,      // true or false - true requires clicking the first button start the timer
    'nextButton'           : true,      // true or false to control whether a next button is used
    'tipAnimation'         : 'fade',    // 'pop' or 'fade' in each tip
    'pauseAfter'           : [],        // array of indexes where to pause the tour after
    'tipAnimationFadeSpeed': 300,       // when tipAnimation = 'fade' this is speed in milliseconds for the transition
    'cookieMonster'        : false,     // true or false to control whether cookies are used
    'cookieName'           : 'joyride', // Name the cookie you'll use
    'cookieDomain'         : false,     // Will this cookie be attached to a domain, ie. '.notableapp.com'
    'tipContainer'         : 'body',    // Where will the tip be attached
    'postRideCallback'     : $.noop,    // A method to call once the tour closes (canceled or complete)
    'postStepCallback'     : $.noop,    // A method to call after each step
    'template' : { // HTML segments for tip layout
      'link'    : '<a href="#close" class="joyride-close-tip">X</a>',
      'timer'   : '<div class="joyride-timer-indicator-wrap"><span class="joyride-timer-indicator">',
      'tip'     : '<div class="joyride-tip-guide"><span class="joyride-nub">',
      'wrapper' : '<div class="joyride-content-wrapper">',
      'button'  : '<a href="#" class="joyride-next-tip small nice radius yellow button">'
    }
  },

  methods = {

    init : function (opts) {
      return this.each(function () {

        settings = $.extend(settings, opts);

        // non configureable settings
        settings.$content_el = $(this);
        settings.body_offset = $(settings.tipContainer).children('*').first().position();
        settings.$tip_content = $('li', settings.$content_el);
        settings.paused = false;
        settings.attempts = 0;

        if (settings.timer > 0) window.interval_id = null;

        // can we create cookies?
        if (!$.isFunction($.cookie)) {
          settings.cookieMonster = false;
        }

        // generate the tips and insert into dom.
        if (!settings.cookieMonster || !$.cookie(settings.cookieName)) {

          settings.$tip_content.each(function (index) {
            methods.create({$li : $(this), index : index});
          });

          // show first tip
          if (!settings.startTimerOnClick && settings.timer > 0) {
            methods.show('init');
            methods.startTimer();
          } else {
            methods.show('init');
          }

        }

        $(document).on('click.joyride', '.joyride-next-tip, .joyride-modal-bg', function (e) {
          e.preventDefault();

          if (settings.$li.next().length < 1) {
            methods.end();
          } else if (settings.timer > 0) {
            methods.hide();
            methods.show();
            methods.startTimer();
          } else {
            methods.hide();
            methods.show();
          }

        });

        $('.joyride-close-tip').on('click.joyride', function (e) {
          methods.end();
        });

        $(window).on('resize.joyride', function (e) {
          if (methods.is_phone()) {
            methods.pos_phone();
          } else {
            methods.pos_default();
          }
        });

      });
    },

    // call this method when you want to resume the tour
    resume : function () {
      methods.set_li();
      methods.show();
    },

    tip_template : function (opts) {
      var $blank, content;
      
      opts.tip_class = opts.tip_class || '';

      $blank = $(settings.template.tip);
      content = $.trim($(opts.li).html()) + 
        methods.button_text(opts.button_text) + 
        settings.template.link + 
        methods.timer_instance(opts.index);

      $blank.append($(settings.template.wrapper));
      $blank.first().attr('data-index', opts.index);
      $('.joyride-content-wrapper', $blank).append(content);

      return $blank[0];
    },

    timer_instance : function (index) {
      var txt;

      if (index === 0 && settings.startTimerOnClick && settings.timer > 0 || settings.timer === 0) {
        txt = '';
      } else {
        txt = methods.outerHTML($(settings.template.timer)[0]);
      }
      return txt;
    },

    button_text : function (txt) {
      if (settings.nextButton) {
        txt = $.trim(txt) || 'Next';
        txt = methods.outerHTML($(settings.template.button).append(txt)[0]);
      } else {
        txt = '';
      }
      return txt;
    },

    create : function (opts) {
      // backwards compatability with data-text attribute
      var buttonText = opts.$li.data('button') || opts.$li.data('text'),
          tipClass = opts.$li.attr('class'),
          $tip_content = $(methods.tip_template({
            tip_class : tipClass,
            index : opts.index,
            button_text : buttonText,
            li : opts.$li
          }));

      $(settings.tipContainer).append($tip_content);
    },

    show : function (init) {
      var opts = {};

      // are we paused?
      if (settings.$li === undefined || ($.inArray(settings.$li.index(), settings.pauseAfter) === -1)) {

        // don't go to the next li if the tour was paused
        if (settings.paused) {
          settings.paused = false;
        } else {
          methods.set_li(init);
        }

        settings.attempts = 0;

        if (settings.$li.next()) {
          
          // parse options
          $.each((settings.$li.data('options') || ':').split(';'),
            function (i, s) {
              var p = s.split(':');
              if (p.length == 2) {
                opts[$.trim(p[0])] = $.trim(p[1]);
              }
            }
          );

          settings.tipSettings = $.extend({}, settings, opts);

          // scroll and position tooltip
          methods.scroll_to();

          if (methods.is_phone()) {
            methods.pos_phone(true);
          } else {
            methods.pos_default(true);
          }

          if (settings.tipAnimation === "pop") {

            $('.joyride-timer-indicator').outerWidth(0);

            if (settings.timer > 0) {

              settings.$next_tip.show()
                .find('.joyride-timer-indicator')
                .animate({width: $('.joyride-timer-indicator-wrap', settings.$next_tip)
                .outerWidth()}, settings.timer);

            } else {

              settings.$next_tip.show();

            }


          } else if (settings.tipAnimation === "fade") {

            $('.joyride-timer-indicator').outerWidth(0);

            if (settings.timer > 0) {

              settings.$next_tip.fadeIn(settings.tipAnimationFadeSpeed)
                .find('.joyride-timer-indicator')
                .animate({width: $('.joyride-timer-indicator-wrap', settings.$next_tip)
                .outerWidth()}, settings.timer);

            } else {

              settings.$next_tip.fadeIn(settings.tipAnimationFadeSpeed);

            }
          }

          settings.$current_tip = settings.$next_tip;

        } else {

          methods.end();

        }
      } else {

        settings.paused = true;

      }

    },

    // detect phones with media queries if supported.
    is_phone : function () {
      if (Modernizr) {
        return Modernizr.mq('only screen and (max-width: 768px)');
      }
      
      return ($(window).width() < 769) ? true : false;
    },

    hide : function () {
      settings.postStepCallback();
      $('.joyride-modal-bg').hide();
      settings.$current_tip.hide();
    },

    set_li : function (init) {
      if (init) {
        settings.$li = settings.$tip_content.first();
        methods.set_next_tip();
        settings.$current_tip = settings.$next_tip;
      } else {
        settings.$li = settings.$li.next();
        methods.set_next_tip();
      }

      methods.set_target();
    },

    set_next_tip : function () {
      settings.$next_tip = $('.joyride-tip-guide[data-index=' + settings.$li.index() + ']');
    },

    set_target : function () {
      // TODO: add support for classes
      var id = settings.$li.data('id');

      if (id) {
        settings.$target = $('#' + id);
      } else {
        // this tip is a modal
        settings.$target = $('body');
      }
    },

    scroll_to : function () {
      var window_half, tipOffset;

      // only scroll if target if off screen
      if (methods.visible(methods.corners(settings.$target))) {

        window_half = $(window).height() / 2,
        tipOffset = Math.ceil(settings.$target.offset().top - window_half);

        $("html, body").animate({
          scrollTop: tipOffset
        }, settings.scrollSpeed);
      }
    },

    paused : function () {
      if (($.inArray((settings.$li.index() + 1), settings.pauseAfter) === -1)) {
        return true;
      }
      
      return false;
    },

    destroy : function () {
      $(window).off('joyride');
      $('.joyride-tip-guide').remove();
    },

    restart : function () {
      methods.hide();
      settings.$li = undefined;
      methods.show('init');
    },

    pos_default : function (init) {
      var half_fold = Math.ceil($(window).height() / 2),
          tip_position = settings.$next_tip.offset(),
          $nub = $('.joyride-nub', settings.$next_tip),
          nub_height = Math.ceil($nub.outerHeight() / 2),
          toggle = init || false;

      // tip must not be "display: none" to calculate position
      if (toggle) {
        settings.$next_tip.css('visibility', 'hidden');
        settings.$next_tip.show();
      }

      if (settings.$target.selector !== 'body') {

          if (methods.bottom()) {

            settings.$next_tip.css({
              top: (settings.$target.offset().top + nub_height + settings.$target.outerHeight()),
              left: settings.$target.offset().left});

            methods.nub_position($nub, settings.tipSettings.nubPosition, 'top');

          } else if (methods.top()) {

            settings.$next_tip.css({
              top: (settings.$target.offset().top - settings.$next_tip.outerHeight() - nub_height),
              left: settings.$target.offset().left});

            methods.nub_position($nub, settings.tipSettings.nubPosition, 'bottom');

          } else if (methods.right()) {

            settings.$next_tip.css({
              top: settings.$target.offset().top,
              left: (settings.$target.outerWidth() + settings.$target.offset().left)});

            methods.nub_position($nub, settings.tipSettings.nubPosition, 'left');

          } else if (methods.left()) {

            settings.$next_tip.css({
              top: settings.$target.offset().top - settings.$target.outerHeight(),
              left: (settings.$target.offset().left - settings.$next_tip.outerWidth() - nub_height)});

            methods.nub_position($nub, settings.tipSettings.nubPosition, 'right');

          }

          if (!methods.visible(methods.corners(settings.$next_tip)) && settings.attempts < 1) {

            $nub.removeClass('bottom')
              .removeClass('top')
              .removeClass('right')
              .removeClass('left');

            settings.tipSettings.tipLocation = methods.invert_pos();

            settings.attempts++;

            methods.pos_default(true);

          }

      } else {
        // show tooltip as modal
        methods.center();
        $nub.hide();

        if ($('.joyride-modal-bg').length < 1) {
          $('body').append('<div class="joyride-modal-bg">');
        }

        if (settings.tipAnimation === "pop") {
          $('.joyride-modal-bg').show();
        } else {
          $('.joyride-modal-bg').fadeIn(settings.tipAnimationFadeSpeed);
        }

      }

      if (toggle) {
        settings.$next_tip.hide();
        settings.$next_tip.css('visibility', 'visible');
      }

    },

    pos_phone : function () {
      var tip_height = settings.$next_tip.outerHeight(),
          tip_offset = settings.$next_tip.offset(),
          target_height = settings.$target.outerHeight(),
          $nub = $('.joyride-nub', settings.$next_tip),
          nub_height = Math.ceil($nub.outerHeight() / 2);

      $nub.removeClass('bottom')
        .removeClass('top')
        .removeClass('right')
        .removeClass('left');

      if (methods.top()) {

          settings.$next_tip.offset({top: settings.$target.offset().top - tip_height - (nub_height*2) + target_height});
          $nub.addClass('bottom');

      } else {

        // Default is bottom alignment.
        settings.$next_tip.offset({top: settings.$target.offset().top + target_height + nub_height});
        $nub.addClass('top');

      }
    },

    center : function () {
      var $w = $(window);

      settings.$next_tip.css({
        top : ((($w.height() - settings.$next_tip.outerHeight()) / 2) + $w.scrollTop()),
        left : ((($w.width() - settings.$next_tip.outerWidth()) / 2) + $w.scrollLeft())
      });

      return true;
    },

    bottom : function () {
      return (settings.tipSettings.tipLocation === "bottom");
    },

    top : function () {
      return (settings.tipSettings.tipLocation === "top");
    },

    right : function () {
      return (settings.tipSettings.tipLocation === "right");
    },

    left : function () {
      return (settings.tipSettings.tipLocation === "left");
    },

    corners : function (el) {
      var w = $(window),
          right = w.outerWidth() + w.scrollLeft(),
          bottom = w.outerWidth() + w.scrollTop();
      
      return [
        el.offset().top <= w.scrollTop(),
        right <= el.offset().left + el.outerWidth(),
        bottom <= el.offset().top + el.outerHeight(),
        w.scrollLeft() >= el.offset().left
      ];
    },

    visible : function (hidden_corners) {
      var i = hidden_corners.length;

      while (i--) {
        if (hidden_corners[i]) return false;
      }

      return true;
    },

    invert_pos : function (pos) {
      if (pos === 'right') {
        return 'bottom';
      } else if (pos === 'top') {
        return 'bottom';
      } else if (pos === 'bottom') {
        return 'top';
      } else {
        return 'bottom';
      }
    },

    nub_position : function (nub, pos, def) {
      if (pos === 'auto') {
        nub.addClass(def);
      } else {
        nub.addClass(pos);
      }
    },

    startTimer : function () {
      clearInterval(interval_id);

      window.interval_id = setInterval(function () {
        methods.hide();
        methods.show();
      }, settings.timer);
    },

    end : function () {
      if (window.interval_id) {
        clearInterval(interval_id);
      }

      if (settings.cookieMonster) {
        $.cookie(settings.cookieName, 'ridden', { expires: 365, domain: settings.cookieDomain });
      }

      $('.joyride-modal-bg').hide();
      settings.$current_tip.hide();

      settings.postRideCallback();
    },

    new_jquery : function () {
      // are we using jQuery 1.7+? (tentative)
      return $.isFunction($.fn.on);
    },

    outerHTML : function (el) {
      // support FireFox < 11
      return el.outerHTML || new XMLSerializer().serializeToString(el);
    }

  };

  $.fn.joyride = function (method) {
    if (methods[method]) {
      return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
    } else if (typeof method === 'object' || !method) {
      return methods.init.apply(this, arguments);
    } else {
      $.error('Method ' +  method + ' does not exist on jQuery.joyride');
    }
  };

}(jQuery, this, document));