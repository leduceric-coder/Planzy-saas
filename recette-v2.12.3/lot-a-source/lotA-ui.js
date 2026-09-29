      /* ================= V2.12.3 — ACTIVITÉS D'ENTREPRISE (interface) =========
         Lecture : companyActivityLots(). Aucun écran ne relit resource.
         activityLotIds à la main. Surface compacte : 2 premières activités puis
         « +N » (bouton, accessible au clavier) ; détail complet dans la fiche. */
      function companyActivityLots(r) {
        if (!r || r.type !== "company" || !Array.isArray(r.activityLotIds)) return [];
        return r.activityLotIds.map((id) => lot(id)).filter(Boolean);
      }
      function activitySummaryText(r, max = 2) {
        let names = companyActivityLots(r).map((l) => l.name);
        if (!names.length) return "";
        return names.slice(0, max).join(", ") + (names.length > max ? ` +${names.length - max}` : "");
      }
      function activityTagHTML(l) {
        return `<span class="act-tag lchip-${esc(l.colorKey || "slate")}${l.active === false ? " is-off" : ""}"><i aria-hidden="true"></i>${esc(l.name)}</span>`;
      }
      /* max = 0 → toutes les activités (fiche). max = 2 → surface compacte. */
      function activityChipsHTML(r, max = 0) {
        let ls = companyActivityLots(r);
        if (!ls.length) return "";
        let shown = max ? ls.slice(0, max) : ls,
          rest = max ? ls.slice(max) : [],
          restNames = rest.map((l) => l.name).join(", ");
        return (
          `<span class="act-tags" aria-label="Activités : ${esc(ls.map((l) => l.name).join(", "))}">` +
          shown.map(activityTagHTML).join("") +
          (rest.length
            ? `<span class="act-rest" hidden>${rest.map(activityTagHTML).join("")}</span>` +
              `<button type="button" class="act-more" data-n="${rest.length}" aria-expanded="false" title="${esc(restNames)}" aria-label="${rest.length} autre${rest.length > 1 ? "s" : ""} activité${rest.length > 1 ? "s" : ""} : ${esc(restNames)}" onclick="event.stopPropagation();toggleActivityMore(this)" onkeydown="event.stopPropagation()">+${rest.length}</button>`
            : "") +
          `</span>`
        );
      }
      function toggleActivityMore(btn) {
        let rest = btn.previousElementSibling,
          opening = !!rest?.hidden;
        if (!rest) return;
        rest.hidden = !opening;
        btn.setAttribute("aria-expanded", String(opening));
        btn.textContent = opening ? "−" : "+" + btn.dataset.n;
      }

      /* ---- Recherche et filtre par activité (page Équipe, palette) -------- */
      let teamQuery = ""; // état de session : volontairement HORS de app.ui
      function teamActivityOptions() {
        let counts = new Map();
        app.resources
          .filter((r) => r.type === "company" && resourceActive(r))
          .forEach((r) => (r.activityLotIds || []).forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
        return lotsOrdered(app.lots)
          .filter((l) => counts.has(l.id))
          .map((l) => ({ id: l.id, name: l.name, count: counts.get(l.id) }));
      }
      /* Un filtre pointant sur une activité qui n'est plus portée par personne
         ne doit jamais rester actif sans être visible : il est ignoré. */
      function teamEffectiveActivityFilter() {
        let f = app.ui.teamActivityFilter || "all";
        return f !== "all" && teamActivityOptions().some((o) => o.id === f) ? f : "all";
      }
      function resourceMatchesTeamSearch(r, q) {
        if (!String(q || "").trim()) return true;
        let hay = [r.name, r.jobTitle, r.companyName, r.contactName, ...companyActivityLots(r).map((l) => l.name)]
          .filter(Boolean)
          .join(" ");
        return norm(hay).includes(norm(String(q).trim()));
      }
      function teamSearchFilters(actFilter) {
        let opts = teamActivityOptions();
        return (
          `<div class="team-find"><div><small>RECHERCHE</small><input id="teamSearch" class="team-search" type="search" autocomplete="off" placeholder="Nom, activité…" aria-label="Rechercher une ressource par nom ou activité" value="${esc(teamQuery)}" oninput="setTeamQuery(this.value)"></div>` +
          (opts.length
            ? `<div><small>ACTIVITÉ</small><select id="teamActivity" class="team-activity" aria-label="Filtrer les entreprises par activité" onchange="setTeamActivityFilter(this.value)"><option value="all">Toutes les activités</option>${opts
                .map(
                  (o) =>
                    `<option value="${esc(o.id)}" ${o.id === actFilter ? "selected" : ""}>${esc(o.name)} · ${o.count}</option>`,
                )
                .join("")}</select></div>`
            : "") +
          `</div>`
        );
      }
      function setTeamQuery(v) {
        teamQuery = String(v ?? "");
        renderPage();
        let s = $("#teamSearch");
        if (s) {
          s.focus();
          s.setSelectionRange(s.value.length, s.value.length);
        }
      }
      function setTeamActivityFilter(v) {
        app.ui.teamActivityFilter = v || "all";
        save();
        renderPage();
        $("#teamActivity")?.focus();
      }
      function resetTeamSearch() {
        teamQuery = "";
        app.ui.teamActivityFilter = "all";
        save();
        renderPage();
      }
      /* Phrase d'usage d'un lot, pour les messages de suppression. */
      function lotUsageText(r) {
        let parts = [];
        if (r.tasks) parts.push(`${r.tasks} intervention${r.tasks > 1 ? "s" : ""}`);
        if (r.templates) parts.push(`${r.templates} étape${r.templates > 1 ? "s" : ""} de modèle`);
        if (r.resources) parts.push(`${r.resources} entreprise${r.resources > 1 ? "s" : ""}`);
        return parts.length > 1 ? parts.slice(0, -1).join(", ") + " et " + parts[parts.length - 1] : parts[0] || "aucun élément";
      }

      /* ---- Sélecteur multiple « Activités / corps d'état » ----------------
         Combobox + chips (motif WAI-ARIA « editable combobox with list
         autocomplete »). L'état vit dans le DOM du formulaire : un champ caché
         `activityItems` par chip, dans l'ORDRE d'affichage, valeur « id:… »
         (lot du référentiel) ou « new:… » (nom à créer à l'enregistrement —
         ainsi annuler le formulaire ne crée rien dans le référentiel). */
      let activityPickerCurrent = [],
        activityPickerIndex = -1;
      function activityPickerChip(kind, value, label) {
        return (
          `<span class="act-chip" data-kind="${kind}" data-value="${esc(value)}">` +
          `<span class="act-chip-label">${esc(label)}</span>` +
          `<button type="button" class="act-x" aria-label="Retirer l’activité ${esc(label)}" onclick="activityPickerRemove(this)">×</button>` +
          `<input type="hidden" name="activityItems" value="${kind === "id" ? "id:" : "new:"}${esc(value)}">` +
          `</span>`
        );
      }
      function activityPickerHTML(selectedIds) {
        let chips = (selectedIds || [])
          .map((id) => lot(id))
          .filter(Boolean)
          .map((l) => activityPickerChip("id", l.id, l.name + (l.active === false ? " (inactif)" : "")))
          .join("");
        return (
          `<div class="act-picker" id="actPicker">` +
          `<span class="act-label" id="actLabel">Activités / corps d’état</span>` +
          `<div class="act-box" onclick="$('#actInput')?.focus();activityPickerRender()">` +
          `<span class="act-chips" id="actChips">${chips}</span>` +
          `<input id="actInput" class="act-input" type="text" role="combobox" aria-labelledby="actLabel" aria-haspopup="listbox" aria-expanded="false" aria-controls="actList" aria-autocomplete="list" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="Rechercher ou ajouter…" oninput="activityPickerRender()" onfocus="activityPickerRender()" onblur="activityPickerBlur()" onkeydown="activityPickerKey(event)">` +
          `</div>` +
          `<ul class="act-list" id="actList" role="listbox" aria-label="Activités disponibles" hidden></ul>` +
          `<small class="muted">Facultatif — une entreprise peut exercer plusieurs activités.</small>` +
          `<span class="act-live" id="actLive" aria-live="polite" role="status"></span>` +
          `</div>`
        );
      }
      function activityPickerState() {
        let chips = [...document.querySelectorAll("#actChips .act-chip")];
        return {
          ids: chips.filter((c) => c.dataset.kind === "id").map((c) => c.dataset.value),
          names: chips.filter((c) => c.dataset.kind === "new").map((c) => c.dataset.value),
        };
      }
      function activityPickerOptions() {
        let input = $("#actInput"),
          q = input ? input.value : "",
          key = activityKey(q),
          st = activityPickerState(),
          chosenKeys = new Set([...st.ids.map((id) => activityKey(lot(id)?.name)), ...st.names.map(activityKey)]),
          pool = [...activeLots(), ...(key ? inactiveLots() : [])],
          opts = pool
            .filter((l) => !st.ids.includes(l.id))
            .filter((l) => !key || activityKey(l.name).includes(key))
            .map((l) => ({ kind: "id", value: l.id, label: l.name + (l.active === false ? " (inactif)" : "") })),
          clean = activityCleanName(q);
        // Création proposée seulement si AUCUN lot (actif ou non) ne porte déjà
        // ce nom et si ce nom n'est pas déjà choisi : aucun doublon possible.
        if (key && !findActivityLot(app.lots, clean) && !chosenKeys.has(key))
          opts.push({ kind: "new", value: clean, label: `Ajouter « ${clean} »`, isNew: true });
        return { opts, already: !!key && chosenKeys.has(key) };
      }
      function activityPickerRender(keepIndex) {
        let input = $("#actInput"),
          list = $("#actList");
        if (!input || !list) return;
        let { opts, already } = activityPickerOptions();
        activityPickerCurrent = opts;
        if (!keepIndex) activityPickerIndex = opts.length && input.value.trim() ? 0 : -1;
        list.innerHTML = opts.length
          ? opts
              .map(
                (o, i) =>
                  `<li role="option" id="actOpt${i}" class="act-opt${o.isNew ? " is-new" : ""}${i === activityPickerIndex ? " is-active" : ""}" aria-selected="${i === activityPickerIndex}" onmousedown="event.preventDefault()" onclick="activityPickerPick(${i})">${esc(o.label)}</li>`,
              )
              .join("")
          : `<li class="act-empty" role="presentation">${already ? "Déjà sélectionnée." : input.value.trim() ? "Aucune activité ne correspond." : "Toutes les activités sont sélectionnées."}</li>`;
        list.hidden = false;
        input.setAttribute("aria-expanded", "true");
        if (activityPickerIndex >= 0) input.setAttribute("aria-activedescendant", "actOpt" + activityPickerIndex);
        else input.removeAttribute("aria-activedescendant");
        list.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
      }
      function activityPickerClose() {
        let input = $("#actInput"),
          list = $("#actList");
        if (list) list.hidden = true;
        if (input) {
          input.setAttribute("aria-expanded", "false");
          input.removeAttribute("aria-activedescendant");
        }
        activityPickerIndex = -1;
      }
      function activityPickerBlur() {
        setTimeout(activityPickerClose, 120);
      }
      function activityPickerAnnounce(text) {
        let live = $("#actLive");
        if (live) live.textContent = text;
      }
      function activityPickerPick(i) {
        let o = activityPickerCurrent[i],
          chips = $("#actChips"),
          input = $("#actInput");
        if (!o || !chips) return;
        // Garde-fou : un même lot ne peut jamais être posé deux fois.
        if (o.kind === "id" && activityPickerState().ids.includes(o.value)) return;
        chips.insertAdjacentHTML("beforeend", activityPickerChip(o.kind, o.value, o.kind === "new" ? o.value : o.label));
        if (input) input.value = "";
        activityPickerClose();
        activityPickerAnnounce((o.kind === "new" ? o.value : o.label) + " ajoutée");
        input?.focus();
      }
      function activityPickerRemove(btn) {
        let chip = btn.closest(".act-chip"),
          label = chip?.querySelector(".act-chip-label")?.textContent || "";
        if (!chip) return;
        chip.remove();
        activityPickerAnnounce(label + " retirée");
        $("#actInput")?.focus();
      }
      function activityPickerKey(e) {
        let list = $("#actList"),
          open = !!list && !list.hidden,
          input = e.currentTarget,
          n = activityPickerCurrent.length;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (!open) return activityPickerRender();
          if (!n) return;
          activityPickerIndex =
            e.key === "ArrowDown" ? (activityPickerIndex + 1) % n : activityPickerIndex <= 0 ? n - 1 : activityPickerIndex - 1;
          activityPickerRender(true);
        } else if (e.key === "Enter") {
          // Entrée dans ce champ choisit une activité : elle ne soumet JAMAIS le formulaire.
          e.preventDefault();
          if (open && activityPickerIndex >= 0) activityPickerPick(activityPickerIndex);
          else if (open && n === 1 && input.value.trim()) activityPickerPick(0);
        } else if (e.key === "Escape") {
          // Échap ferme d'abord la liste ; il ne ferme le tiroir qu'au coup suivant.
          if (open) {
            e.preventDefault();
            e.stopPropagation();
            activityPickerClose();
          }
        } else if (e.key === "Backspace" && !input.value) {
          let last = [...document.querySelectorAll("#actChips .act-chip")].pop();
          if (last) activityPickerRemove(last.querySelector(".act-x"));
        }
      }
      /* Lit le sélecteur à l'envoi. Un texte tapé mais non validé n'est pas
         perdu en silence : il est traité comme une activité à ajouter. */
      function activityPickerCollect(f) {
        // Le champ n'est lu que si le tiroir est OUVERT : le DOM d'un formulaire
        // fermé survit jusqu'au prochain tiroir et ne doit jamais fuiter ici.
        let items = f.getAll("activityItems").filter(Boolean),
          live = $("#drawer")?.classList.contains("open"),
          pending = live ? activityCleanName($("#actInput")?.value || "") : "";
        if (pending) {
          let hit = findActivityLot(app.lots, pending);
          items.push(hit ? "id:" + hit.id : "new:" + pending);
        }
        return items;
      }
      /* À appeler APRÈS snapshot() : création éventuelle de lots + affectation
         tiennent dans la MÊME transaction Annuler/Rétablir. */
      function applyCompanyActivities(r, f) {
        let ids = [],
          add = (id) => {
            if (id && !ids.includes(id)) ids.push(id);
          };
        activityPickerCollect(f).forEach((item) => {
          if (item.startsWith("id:")) {
            let id = item.slice(3);
            if (lot(id)) add(id);
          } else if (item.startsWith("new:")) {
            let res = ensureActivityLot(app.lots, item.slice(4), historyNow());
            if (res.created) logLotEvent("lot-created", res.lot.id, `Lot « ${res.lot.name} » créé depuis une fiche entreprise.`);
            add(res.lot?.id);
          }
        });
        r.activityLotIds = ids.slice(0, 20);
      }
