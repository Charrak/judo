/* ATAI Studio – admin behaviour (vanilla, no dependencies) */
(function () {
  'use strict';

  var csrfMeta = document.querySelector('meta[name="csrf"]');
  var csrf = csrfMeta ? csrfMeta.getAttribute('content') : '';
  var toastEl = document.querySelector('[data-toast]');
  var toastTimer = null;

  function toast(message, isError) {
    if (!toastEl || !message) return;
    toastEl.textContent = message;
    toastEl.classList.toggle('is-error', Boolean(isError));
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, isError ? 6500 : 3200);
  }

  if (document.body.dataset.flash) toast(document.body.dataset.flash, false);

  function api(url, options) {
    var config = options || {};
    var headers = Object.assign({ 'x-csrf': csrf }, config.headers || {});
    if (config.json !== undefined) {
      headers['content-type'] = 'application/json';
      config.body = JSON.stringify(config.json);
    }
    return fetch(url, {
      method: config.method || 'POST',
      headers: headers,
      body: config.body,
      credentials: 'same-origin',
    }).then(function (response) {
      return response.json().catch(function () {
        return { ok: false, error: 'Der Server hat unerwartet geantwortet (' + response.status + ').' };
      });
    });
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = label || 'Speichern …';
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
    }
  }

  /* ------------------------------------------------------------- text editor */

  var editor = document.querySelector('[data-text-editor]');
  if (editor) {
    var savebar = document.querySelector('[data-savebar]');
    var dirtyCount = savebar ? savebar.querySelector('[data-dirty-count]') : null;
    var saveButton = savebar ? savebar.querySelector('[data-save]') : null;
    var discardButton = savebar ? savebar.querySelector('[data-discard]') : null;
    var fields = [].slice.call(editor.querySelectorAll('[data-field]'));
    var search = document.querySelector('[data-search]');
    var onlyChanged = document.querySelector('[data-only-changed]');
    var emptyFilter = document.querySelector('[data-empty-filter]');
    var overridesMeta = document.querySelector('[data-overrides-meta]');
    var totalFields = fields.length;

    function fieldValue(field) {
      return field.querySelector('[data-input]').value;
    }

    function isDirty(field) {
      return fieldValue(field) !== field.getAttribute('data-original');
    }

    function isChanged(field) {
      return fieldValue(field) !== field.getAttribute('data-base');
    }

    function refreshField(field) {
      var dirty = isDirty(field);
      var changed = isChanged(field);
      field.classList.toggle('is-dirty', dirty);
      var badge = field.querySelector('[data-badge]');
      if (badge) badge.hidden = !changed;
      var reset = field.querySelector('[data-reset]');
      if (reset) reset.hidden = !changed;
      var counter = field.querySelector('[data-counter]');
      if (counter) counter.textContent = fieldValue(field).length;
    }

    function refreshBar() {
      var dirty = fields.filter(isDirty).length;
      if (dirtyCount) dirtyCount.textContent = String(dirty);
      if (savebar) savebar.hidden = dirty === 0;
    }

    function filterFields() {
      var query = (search ? search.value : '').trim().toLowerCase();
      var changedOnly = onlyChanged ? onlyChanged.checked : false;
      var visible = 0;
      var groups = editor.querySelectorAll('[data-group]');
      [].forEach.call(groups, function (group) {
        var shown = 0;
        [].forEach.call(group.querySelectorAll('[data-field]'), function (field) {
          var haystack = (
            field.getAttribute('data-path') +
            ' ' +
            field.querySelector('[data-input]').value +
            ' ' +
            (field.querySelector('[data-label-text]') ? field.querySelector('[data-label-text]').textContent : '')
          ).toLowerCase();
          var matchesQuery = !query || haystack.indexOf(query) !== -1;
          var matchesChanged = !changedOnly || isChanged(field);
          var show = matchesQuery && matchesChanged;
          field.hidden = !show;
          if (show) shown += 1;
        });
        group.hidden = shown === 0;
        visible += shown;
      });
      if (emptyFilter) emptyFilter.hidden = visible !== 0;
    }

    fields.forEach(function (field) {
      var input = field.querySelector('[data-input]');
      input.addEventListener('input', function () {
        refreshField(field);
        refreshBar();
        if (onlyChanged && onlyChanged.checked) filterFields();
      });
      var reset = field.querySelector('[data-reset]');
      if (reset) {
        reset.addEventListener('click', function () {
          input.value = field.getAttribute('data-base');
          refreshField(field);
          refreshBar();
          filterFields();
          input.focus();
        });
      }
    });

    if (search) search.addEventListener('input', filterFields);
    if (onlyChanged) onlyChanged.addEventListener('change', filterFields);

    if (discardButton) {
      discardButton.addEventListener('click', function () {
        fields.forEach(function (field) {
          field.querySelector('[data-input]').value = field.getAttribute('data-original');
          refreshField(field);
        });
        refreshBar();
        filterFields();
      });
    }

    if (saveButton) {
      saveButton.addEventListener('click', function () {
        var values = {};
        var invalid = null;
        fields.filter(isDirty).forEach(function (field) {
          var value = fieldValue(field).trim();
          if (!value) invalid = invalid || field;
          if (value === field.getAttribute('data-original').trim()) return;
          values[field.getAttribute('data-path')] = value;
        });

        if (invalid) {
          invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
          invalid.querySelector('[data-input]').focus();
          toast('Bitte alle Felder ausfüllen – leere Texte kann die Website nicht anzeigen.', true);
          return;
        }
        if (!Object.keys(values).length) {
          refreshBar();
          return;
        }

        setBusy(saveButton, true, 'Speichern …');
        api(editor.getAttribute('data-endpoint'), { json: { lang: editor.getAttribute('data-lang'), values: values } })
          .then(function (result) {
            setBusy(saveButton, false);
            if (!result.ok) {
              toast(result.error || 'Speichern fehlgeschlagen.', true);
              return;
            }
            fields.forEach(function (field) {
              field.setAttribute('data-original', field.querySelector('[data-input]').value);
              refreshField(field);
            });
            refreshBar();
            filterFields();
            if (overridesMeta && typeof result.overrides === 'number') {
              overridesMeta = document.querySelector('[data-overrides-meta]');
              overridesMeta.textContent =
                result.overrides + ' von ' + totalFields + ' Feldern geändert';
            }
            toast('Gespeichert – Website neu gebaut (' + result.ms + ' ms).');
          })
          .catch(function () {
            setBusy(saveButton, false);
            toast('Netzwerkfehler – bitte erneut versuchen.', true);
          });
      });
    }

    window.addEventListener('beforeunload', function (event) {
      if (fields.some(isDirty)) {
        event.preventDefault();
        event.returnValue = '';
      }
    });

    refreshBar();
  }

  /* -------------------------------------------------------------- news form */

  var newsForm = document.querySelector('[data-news-form]');
  if (newsForm) {
    var newsError = newsForm.querySelector('[data-form-error]');
    var publishHint = newsForm.querySelector('[data-publish-hint]');
    var imageInput = newsForm.querySelector('[data-image]');
    var preview = newsForm.querySelector('[data-preview]');
    var fileInput = newsForm.querySelector('[data-file]');
    var removeImage = newsForm.querySelector('[data-remove-image]');
    var publishedBox = newsForm.querySelector('[data-published]');
    var slugInput = newsForm.querySelector('[data-slug]');
    var deTitle = newsForm.querySelector('[data-title="de"]');
    var deleteButton = newsForm.querySelector('[data-delete]');
    var submitButton = newsForm.querySelector('button[type="submit"]');
    var langs = ['de', 'en', 'ar', 'fr', 'es'];

    function showError(message) {
      if (!newsError) return;
      newsError.hidden = !message;
      newsError.textContent = message || '';
    }

    function setImage(src) {
      if (imageInput) imageInput.value = src || '';
      if (removeImage) removeImage.hidden = !src;
      if (preview) {
        preview.classList.toggle('has-image', Boolean(src));
        preview.innerHTML = src ? '<img src="' + src + '" alt="">' : '<span>Kein Bild</span>';
      }
    }

    function slugify(value) {
      return String(value)
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 70);
    }

    if (deTitle && slugInput) {
      deTitle.addEventListener('input', function () {
        if (!slugInput.dataset.touched) slugInput.value = slugify(deTitle.value);
      });
      slugInput.addEventListener('input', function () {
        slugInput.dataset.touched = slugInput.value ? '1' : '';
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        toast('Bild wird hochgeladen …');
        api('/api/admin/upload?kind=news', {
          headers: { 'content-type': file.type || 'application/octet-stream' },
          body: file,
        })
          .then(function (result) {
            if (!result.ok) {
              toast(result.error || 'Upload fehlgeschlagen.', true);
              return;
            }
            setImage(result.src);
            toast('Bild hochgeladen.');
          })
          .catch(function () {
            toast('Upload fehlgeschlagen.', true);
          });
        fileInput.value = '';
      });
    }

    if (removeImage) {
      removeImage.addEventListener('click', function () {
        setImage('');
      });
    }

    function missingLanguages() {
      return langs.filter(function (code) {
        var title = newsForm.querySelector('[data-title="' + code + '"]');
        var body = newsForm.querySelector('[data-body="' + code + '"]');
        return !title || title.value.trim().length < 2 || !body || body.value.trim().length < 10;
      });
    }

    function updatePublishHint() {
      if (!publishHint) return;
      if (!publishedBox || !publishedBox.checked) {
        publishHint.hidden = true;
        return;
      }
      var missing = missingLanguages();
      publishHint.hidden = missing.length === 0;
      publishHint.textContent = missing.length
        ? 'Zum Veröffentlichen fehlen Titel oder Text in: ' + missing.map(function (code) { return code.toUpperCase(); }).join(', ')
        : '';
    }

    if (publishedBox) publishedBox.addEventListener('change', updatePublishHint);
    newsForm.addEventListener('input', updatePublishHint);

    newsForm.addEventListener('submit', function (event) {
      event.preventDefault();
      showError('');
      var translations = {};
      langs.forEach(function (code) {
        var title = newsForm.querySelector('[data-title="' + code + '"]');
        var body = newsForm.querySelector('[data-body="' + code + '"]');
        translations[code] = {
          title: title ? title.value.trim() : '',
          body: body ? body.value.trim() : '',
        };
      });

      var payload = {
        id: newsForm.getAttribute('data-id') || '',
        date: newsForm.querySelector('[data-date]').value,
        slug: newsForm.querySelector('[data-slug]').value.trim(),
        published: Boolean(publishedBox && publishedBox.checked),
        image: imageInput ? imageInput.value : '',
        translations: translations,
      };

      setBusy(submitButton, true, 'Speichern …');
      api('/api/admin/news', { json: { action: 'save', entry: payload } })
        .then(function (result) {
          setBusy(submitButton, false);
          if (!result.ok) {
            showError(result.error || 'Speichern fehlgeschlagen.');
            return;
          }
          window.location.href = '/admin/neuigkeiten/?flash=' + encodeURIComponent('Beitrag gespeichert.');
        })
        .catch(function () {
          setBusy(submitButton, false);
          showError('Netzwerkfehler – bitte erneut versuchen.');
        });
    });

    if (deleteButton) {
      deleteButton.addEventListener('click', function () {
        if (!window.confirm('Diesen Beitrag wirklich löschen?')) return;
        setBusy(deleteButton, true, 'Löschen …');
        api('/api/admin/news', { json: { action: 'delete', id: newsForm.getAttribute('data-id') } })
          .then(function (result) {
            setBusy(deleteButton, false);
            if (!result.ok) {
              showError(result.error || 'Löschen fehlgeschlagen.');
              return;
            }
            window.location.href = '/admin/neuigkeiten/?flash=' + encodeURIComponent('Beitrag gelöscht.');
          })
          .catch(function () {
            setBusy(deleteButton, false);
            showError('Netzwerkfehler – bitte erneut versuchen.');
          });
      });
    }
  }

  /* ----------------------------------------------------------- gallery editor */

  var gallery = document.querySelector('[data-gallery-editor]');
  if (gallery) {
    var galleryBar = document.querySelector('[data-savebar]');
    var galleryCount = galleryBar ? galleryBar.querySelector('[data-dirty-count]') : null;
    var gallerySave = galleryBar ? galleryBar.querySelector('[data-save]') : null;
    var galleryDiscard = galleryBar ? galleryBar.querySelector('[data-discard]') : null;
    var galleryDirty = 0;
    var uploadInput = document.querySelector('[data-gallery-file]');
    var languages = ['de', 'en', 'ar', 'fr', 'es'];

    function markDirty(count) {
      galleryDirty += count || 1;
      if (galleryCount) galleryCount.textContent = String(galleryDirty);
      if (galleryBar) galleryBar.hidden = galleryDirty === 0;
    }

    function itemMarkup(item) {
      var captions = languages
        .map(function (code) {
          return (
            '<label class="gitem__caption"><span>' +
            code.toUpperCase() +
            '</span><input class="input" type="text" data-caption="' +
            code +
            '"' +
            (code === 'ar' ? ' dir="rtl"' : '') +
            ' placeholder="Bildbeschreibung"></label>'
          );
        })
        .join('');
      return (
        '<div class="gitem__thumb"><img src="' +
        item.src +
        '" alt="" loading="lazy"></div>' +
        '<div class="gitem__fields">' +
        captions +
        '</div>' +
        '<div class="gitem__tools">' +
        '<button class="mini" type="button" data-move="up" title="nach oben">↑</button>' +
        '<button class="mini" type="button" data-move="down" title="nach unten">↓</button>' +
        '<button class="mini mini--danger" type="button" data-remove>Entfernen</button>' +
        '</div>'
      );
    }

    function bindItem(li) {
      [].forEach.call(li.querySelectorAll('[data-caption]'), function (input) {
        input.addEventListener('input', function () {
          markDirty(1);
        });
      });
      var remove = li.querySelector('[data-remove]');
      if (remove) {
        remove.addEventListener('click', function () {
          li.parentNode.removeChild(li);
          markDirty(1);
        });
      }
      [].forEach.call(li.querySelectorAll('[data-move]'), function (button) {
        button.addEventListener('click', function () {
          var direction = button.getAttribute('data-move');
          if (direction === 'up' && li.previousElementSibling) {
            li.parentNode.insertBefore(li, li.previousElementSibling);
          } else if (direction === 'down' && li.nextElementSibling) {
            li.parentNode.insertBefore(li.nextElementSibling, li);
          }
          markDirty(1);
        });
      });
    }

    [].forEach.call(gallery.children, bindItem);

    if (uploadInput) {
      uploadInput.addEventListener('change', function () {
        var files = [].slice.call(uploadInput.files || []);
        if (!files.length) return;
        uploadInput.value = '';
        var chain = Promise.resolve();
        files.forEach(function (file) {
          chain = chain.then(function () {
            toast('Lade „' + file.name + '“ hoch …');
            return api('/api/admin/upload?kind=gallery', {
              headers: { 'content-type': file.type || 'application/octet-stream' },
              body: file,
            }).then(function (result) {
              if (!result.ok) {
                toast(result.error || 'Upload fehlgeschlagen.', true);
                return;
              }
              var li = document.createElement('li');
              li.className = 'gitem';
              li.setAttribute('data-item', '');
              li.setAttribute('data-src', result.src);
              li.setAttribute('data-width', String(result.width));
              li.setAttribute('data-height', String(result.height));
              li.setAttribute('data-uploaded', '1');
              li.setAttribute('data-id', '');
              li.innerHTML = itemMarkup(result);
              gallery.appendChild(li);
              bindItem(li);
              markDirty(1);
              toast('Bild hochgeladen – jetzt beschriften.');
            });
          });
        });
        return chain;
      });
    }

    if (galleryDiscard) {
      galleryDiscard.addEventListener('click', function () {
        window.location.reload();
      });
    }

    if (gallerySave) {
      gallerySave.addEventListener('click', function () {
        var items = [].map.call(gallery.querySelectorAll('[data-item]'), function (li) {
          var captions = {};
          var missing = false;
          languages.forEach(function (code) {
            var input = li.querySelector('[data-caption="' + code + '"]');
            var value = input ? input.value.trim() : '';
            if (!value) missing = true;
            captions[code] = value;
          });
          return {
            id: li.getAttribute('data-id') || '',
            src: li.getAttribute('data-src'),
            width: Number(li.getAttribute('data-width')) || 0,
            height: Number(li.getAttribute('data-height')) || 0,
            uploaded: li.getAttribute('data-uploaded') === '1',
            captions: captions,
            missing: missing,
          };
        });

        var incomplete = items.findIndex(function (item) {
          return item.missing;
        });
        if (incomplete !== -1) {
          var target = gallery.querySelectorAll('[data-item]')[incomplete];
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          toast('Bild ' + (incomplete + 1) + ': Bitte alle fünf Beschriftungen ausfüllen.', true);
          return;
        }

        setBusy(gallerySave, true, 'Speichern …');
        api(gallery.getAttribute('data-endpoint'), {
          json: { items: items.map(function (item) { delete item.missing; return item; }) },
        })
          .then(function (result) {
            setBusy(gallerySave, false);
            if (!result.ok) {
              toast(result.error || 'Speichern fehlgeschlagen.', true);
              return;
            }
            window.location.href = '/admin/galerie/?flash=' + encodeURIComponent('Galerie gespeichert.');
          })
          .catch(function () {
            setBusy(gallerySave, false);
            toast('Netzwerkfehler – bitte erneut versuchen.', true);
          });
      });
    }
  }

  /* ---------------------------------------------------------------- messages */

  var messages = document.querySelector('[data-messages]');
  if (messages) {
    var endpoint = messages.getAttribute('data-endpoint');
    [].forEach.call(messages.querySelectorAll('[data-delete]'), function (button) {
      button.addEventListener('click', function () {
        var item = button.closest('[data-id]');
        if (!item) return;
        if (!window.confirm('Diese Nachricht löschen?')) return;
        api(endpoint, { json: { action: 'delete', id: item.getAttribute('data-id') } }).then(function (result) {
          if (!result.ok) {
            toast(result.error || 'Löschen fehlgeschlagen.', true);
            return;
          }
          item.parentNode.removeChild(item);
          toast('Nachricht gelöscht.');
        });
      });
    });

    var clear = document.querySelector('[data-clear-messages]');
    if (clear) {
      clear.addEventListener('click', function () {
        if (!window.confirm('Alle Nachrichten löschen? Das kann nicht rückgängig gemacht werden.')) return;
        api(endpoint, { json: { action: 'clear' } }).then(function (result) {
          if (!result.ok) {
            toast(result.error || 'Löschen fehlgeschlagen.', true);
            return;
          }
          window.location.href = '/admin/nachrichten/?flash=' + encodeURIComponent('Alle Nachrichten gelöscht.');
        });
      });
    }
  }
})();
