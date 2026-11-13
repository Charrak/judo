/* ATAI JUDO ACADEMY — progressive enhancement.
   No copy lives here: every message comes from the embedded i18n payload. */
(function () {
  'use strict';

  var dataNode = document.getElementById('app-data');
  var data = dataNode ? JSON.parse(dataNode.textContent) : null;
  var strings = (data && data.strings) || { ui: {}, form: {}, welcome: {} };
  var html = document.documentElement;

  /* ------------------------------------------------------------- language */
  function setLanguage(code) {
    try {
      localStorage.setItem((data && data.storageKey) || 'atai.lang', code);
      sessionStorage.setItem((data && data.switchFlag) || 'atai.switch', '1');
    } catch (error) {
      /* storage can be unavailable in private modes – navigation still works */
    }
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest('[data-lang-switch]');
    if (link) setLanguage(link.getAttribute('data-lang-switch'));
  });

  /* --------------------------------------------------------------- header */
  var header = document.querySelector('[data-header]');
  var nav = document.getElementById('site-nav');
  var menuToggle = document.querySelector('[data-menu-toggle]');

  function onScroll() {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 16);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function setMenu(open) {
    if (!nav || !menuToggle) return;
    nav.classList.toggle('is-open', open);
    header.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    var label = menuToggle.querySelector('.sr-only');
    if (label) label.textContent = open ? strings.ui.closeMenu : strings.ui.openMenu;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      var first = nav.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    }
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', function () {
      setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
    });
  }

  if (nav) {
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });
  }

  /* ----------------------------------------------------------- language UI */
  var langMenus = Array.prototype.slice.call(document.querySelectorAll('[data-lang-menu]'));

  langMenus.forEach(function (menu) {
    menu.addEventListener('toggle', function () {
      if (!menu.open) return;
      langMenus.forEach(function (other) {
        if (other !== menu) other.open = false;
      });
    });
  });

  document.addEventListener('click', function (event) {
    langMenus.forEach(function (menu) {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    langMenus.forEach(function (menu) {
      if (menu.open) {
        menu.open = false;
        var summary = menu.querySelector('summary');
        if (summary) summary.focus();
      }
    });
    if (menuToggle && menuToggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menuToggle.focus();
    }
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 1080 && menuToggle && menuToggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
    }
  });

  /* ------------------------------------------------------------- welcome */
  // Returning from the bfcache can bring back the "first visit" state.
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    var stored = null;
    try {
      stored = localStorage.getItem((data && data.storageKey) || 'atai.lang');
    } catch (error) {}
    if (stored) html.removeAttribute('data-entry');
  });

  var welcome = document.getElementById('welcome-overlay');
  var entryPending = html.getAttribute('data-entry') === 'pending';

  if (welcome && entryPending) {
    ['[data-header]', 'main', '.site-footer'].forEach(function (selector) {
      var node = document.querySelector(selector);
      if (node && 'inert' in node) node.inert = true;
    });
    var choices = welcome.querySelector('.welcome__choice');
    if (choices) {
      window.setTimeout(function () {
        choices.focus({ preventScroll: true });
      }, 60);
    }

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab') return;
      var focusable = welcome.querySelectorAll('a[href]');
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  /* --------------------------------------------------------------- reveal */
  var revealItems = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  if ('IntersectionObserver' in window && revealItems.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
    );
    revealItems.forEach(function (item) {
      observer.observe(item);
    });
  } else {
    revealItems.forEach(function (item) {
      item.classList.add('is-visible');
    });
  }

  /* ------------------------------------------------------------- lightbox */
  var lightbox = document.querySelector('[data-lightbox]');
  var galleryItems = Array.prototype.slice.call(document.querySelectorAll('[data-gallery-item]'));

  if (lightbox && galleryItems.length) {
    var image = lightbox.querySelector('[data-lightbox-image]');
    var caption = lightbox.querySelector('[data-lightbox-caption]');
    var counter = lightbox.querySelector('[data-lightbox-counter]');
    var currentIndex = 0;
    var lastTrigger = null;

    function showSlide(index) {
      currentIndex = (index + galleryItems.length) % galleryItems.length;
      var item = galleryItems[currentIndex];
      image.src = item.getAttribute('data-src');
      image.alt = item.getAttribute('data-caption') || '';
      caption.textContent = item.getAttribute('data-caption') || '';
      counter.textContent = strings.ui.imageCounter
        .replace('{current}', String(currentIndex + 1))
        .replace('{total}', String(galleryItems.length));
    }

    function openLightbox(index, trigger) {
      lastTrigger = trigger;
      showSlide(index);
      if (typeof lightbox.showModal === 'function') {
        lightbox.showModal();
      } else {
        lightbox.setAttribute('open', '');
      }
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      if (typeof lightbox.close === 'function' && lightbox.open) {
        lightbox.close();
      } else {
        lightbox.removeAttribute('open');
      }
      document.body.style.overflow = '';
      if (lastTrigger) lastTrigger.focus();
    }

    galleryItems.forEach(function (item) {
      item.addEventListener('click', function () {
        openLightbox(Number(item.getAttribute('data-index')) || 0, item);
      });
    });

    lightbox.querySelector('[data-lightbox-close]').addEventListener('click', closeLightbox);
    lightbox.querySelector('[data-lightbox-prev]').addEventListener('click', function () {
      showSlide(currentIndex - 1);
    });
    lightbox.querySelector('[data-lightbox-next]').addEventListener('click', function () {
      showSlide(currentIndex + 1);
    });

    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) closeLightbox();
    });

    lightbox.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        showSlide(currentIndex + 1);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showSlide(currentIndex - 1);
      }
    });

    lightbox.addEventListener('close', function () {
      document.body.style.overflow = '';
    });
  }

  /* ----------------------------------------------------------------- form */
  var form = document.querySelector('[data-contact-form]');

  if (form) {
    var submitButton = form.querySelector('[data-submit]');
    var submitLabel = form.querySelector('[data-submit-label]');
    var statusNode = form.querySelector('[data-form-status]');
    var successPanel = form.querySelector('[data-form-success]');
    var defaultLabel = submitLabel ? submitLabel.textContent : '';
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function fieldWrap(field) {
      return field.closest('.field') || field.parentNode;
    }

    function errorNode(name) {
      return form.querySelector('[data-error-for="' + name + '"]');
    }

    function setError(name, message) {
      var node = errorNode(name);
      var field = form.querySelector('[data-field="' + name + '"]');
      if (node) {
        node.textContent = message;
        node.hidden = !message;
      }
      if (field) fieldWrap(field).classList.toggle('is-invalid', Boolean(message));
    }

    function clearErrors() {
      ['name', 'email', 'message', 'consent'].forEach(function (name) {
        setError(name, '');
      });
      if (statusNode) statusNode.textContent = '';
    }

    function validate() {
      var errors = {};
      var values = {
        name: form.querySelector('[data-field="name"]').value.trim(),
        email: form.querySelector('[data-field="email"]').value.trim(),
        message: form.querySelector('[data-field="message"]').value.trim(),
      };
      if (values.name.length < 2) errors.name = strings.form.errors.name;
      if (!emailPattern.test(values.email)) errors.email = strings.form.errors.email;
      if (values.message.length < 10) errors.message = strings.form.errors.message;
      if (!form.querySelector('[data-field="consent"]').checked) errors.consent = strings.form.errors.consent;
      return errors;
    }

    form.addEventListener('input', function (event) {
      var field = event.target.closest('[data-field]');
      if (field && errorNode(field.getAttribute('data-field'))) {
        setError(field.getAttribute('data-field'), '');
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clearErrors();

      var errors = validate();
      var keys = Object.keys(errors);
      if (keys.length) {
        keys.forEach(function (key) {
          setError(key, errors[key]);
        });
        if (statusNode) statusNode.textContent = strings.ui.errorSummary || '';
        var firstInvalid = form.querySelector('[data-field="' + keys[0] + '"]');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      var payload = {
        name: form.querySelector('[data-field="name"]').value.trim(),
        email: form.querySelector('[data-field="email"]').value.trim(),
        phone: form.querySelector('[data-field="phone"]').value.trim(),
        interest: form.querySelector('[data-field="interest"]').value,
        message: form.querySelector('[data-field="message"]').value.trim(),
        consent: true,
        company: form.querySelector('[name="company"]').value,
        lang: (data && data.lang) || '',
        page: window.location.pathname,
      };

      if (submitButton) submitButton.disabled = true;
      if (submitLabel) submitLabel.textContent = strings.form.submitting;

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (response) {
          return response.json().catch(function () {
            return {};
          });
        })
        .then(function (result) {
          if (!result || !result.ok) {
            var details = (result && result.errors) || {};
            Object.keys(details).forEach(function (key) {
              if (strings.form.errors[key]) setError(key, strings.form.errors[key]);
            });
            if (statusNode) statusNode.textContent = strings.form.errors.generic;
            return;
          }
          form.classList.add('is-sent');
          if (successPanel) {
            successPanel.hidden = false;
            var heading = successPanel.querySelector('.form__successTitle');
            if (heading) {
              heading.setAttribute('tabindex', '-1');
              heading.focus({ preventScroll: true });
            }
            form.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        })
        .catch(function () {
          if (statusNode) statusNode.textContent = strings.form.errors.generic;
        })
        .then(function () {
          if (submitButton) submitButton.disabled = false;
          if (submitLabel) submitLabel.textContent = defaultLabel;
        });
    });

    var resetButton = form.querySelector('[data-form-reset]');
    if (resetButton) {
      resetButton.addEventListener('click', function () {
        form.reset();
        form.classList.remove('is-sent');
        if (successPanel) successPanel.hidden = true;
        clearErrors();
        var first = form.querySelector('[data-field="name"]');
        if (first) first.focus();
      });
    }
  }
})();
