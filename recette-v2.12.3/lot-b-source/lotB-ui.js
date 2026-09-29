      /* ================= PROTOTYPE — BILAN DES RETARDS (interface) ============
         Route INTERNE « delays » (aucune entrée de barre latérale, comme
         « operation » et « structure ») : on y entre depuis la fiche chantier.
         Les réglages de vue vivent HORS de app.ui : rien n'est persisté. */
      let delaysView = { type: "all", cause: "all", company: "all", person: "all", attribution: "all" };
      const DELAY_STATE_LABEL = { done: "Terminé", in_progress: "En cours", planned: "À venir" };

      function delayResName(id) {
        return resource(id)?.name || id || "—";
      }
      function delayShort(key) {
        return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(key + "T12:00"));
      }
      /* Retourne du HTML : chaque date est insécable, seule la flèche peut couper. */
      function delayRange(pair) {
        let nw = (k) => `<span class="dly-nw">${esc(delayShort(k))}</span>`;
        return pair[0] === pair[1] ? nw(pair[0]) : `${nw(pair[0])} → ${nw(pair[1])}`;
      }
      function delayPlural(n, one, many) {
        return n > 1 ? many : one;
      }
      function delayModelFor(projectId) {
        let fx = DELAY_FIXTURES.projects[projectId];
        return fx ? buildDelayBilan(fx) : null;
      }
      function delaySortedRows(model) {
        return model.rows
          .slice()
          .sort((a, b) => a.task.base[0].localeCompare(b.task.base[0]) || a.task.name.localeCompare(b.task.name, "fr"));
      }
      function openDelaysBilan(projectId) {
        app.ui.projectId = projectId;
        go("delays");
      }
      function setDelayFilter(key, value) {
        delaysView[key] = value || "all";
        renderPage();
        let id = { cause: "dlyCause", company: "dlyCompany", person: "dlyPerson", attribution: "dlyAttr" }[key];
        (id ? $("#" + id) : $(`.dly-seg button[data-v="${value}"]`))?.focus();
      }
      function resetDelayFilters() {
        delaysView = { type: "all", cause: "all", company: "all", person: "all", attribution: "all" };
        renderPage();
        $("#dlyCause")?.focus();
      }
      function delayFiltersActive() {
        return Object.values(delaysView).some((v) => v !== "all");
      }

      function delayFilterBar(model) {
        let rows = model.rows,
          uniq = (fn) => [...new Set(rows.flatMap(fn))],
          causes = [...new Set(rows.map((r) => r.rootCause).filter(Boolean))],
          involved = uniq((r) => [...r.associatedIds, ...r.responsibleIds]),
          companies = involved.filter((id) => resource(id)?.type === "company"),
          persons = involved.filter((id) => resource(id)?.type === "person"),
          count = (fn) => rows.filter(fn).length,
          sel = (id, label, key, options) =>
            `<div><small>${label}</small><select id="${id}" aria-label="Filtrer par ${label.toLowerCase()}" onchange="setDelayFilter('${key}',this.value)"><option value="all">Tous</option>${options
              .map(([v, l]) => `<option value="${esc(v)}" ${delaysView[key] === v ? "selected" : ""}>${esc(l)}</option>`)
              .join("")}</select></div>`;
        return (
          `<div class="dly-filters" role="group" aria-label="Filtres du bilan des retards">` +
          `<div><small id="dlyTypeLbl">NATURE</small><div class="segment dly-seg" role="group" aria-labelledby="dlyTypeLbl">${[
            ["all", "Tous"],
            ["direct", "Directs"],
            ["inherited", "Hérités"],
          ]
            .map(
              ([v, l]) =>
                `<button type="button" data-v="${v}" class="${delaysView.type === v ? "active" : ""}" aria-pressed="${delaysView.type === v}" onclick="setDelayFilter('type','${v}')">${l}</button>`,
            )
            .join("")}</div></div>` +
          sel("dlyCause", "CAUSE", "cause", DELAY_CAUSES.filter((c) => causes.includes(c[0])).map((c) => [c[0], `${c[1]} · ${count((r) => r.rootCause === c[0])}`])) +
          sel("dlyCompany", "ENTREPRISE", "company", companies.map((id) => [id, `${delayResName(id)} · ${count((r) => r.associatedIds.includes(id) || r.responsibleIds.includes(id))}`])) +
          sel("dlyPerson", "PERSONNE", "person", persons.map((id) => [id, `${delayResName(id)} · ${count((r) => r.associatedIds.includes(id) || r.responsibleIds.includes(id))}`])) +
          `<div><small>ATTRIBUTION</small><select id="dlyAttr" aria-label="Filtrer par attribution" onchange="setDelayFilter('attribution',this.value)">${[
            ["all", "Toutes"],
            ["confirmed", "Confirmées"],
            ["pending", "À confirmer"],
            ["none", "Sans responsable désigné"],
          ]
            .map(([v, l]) => `<option value="${v}" ${delaysView.attribution === v ? "selected" : ""}>${l}</option>`)
            .join("")}</select></div>` +
          (delayFiltersActive() ? `<div><small>&nbsp;</small><button type="button" class="link" onclick="resetDelayFilters()">Réinitialiser</button></div>` : "") +
          `</div>`
        );
      }

      function delayRowHTML(r) {
        let t = r.task,
          direct = r.type === "direct",
          lotName = t.lotId ? lot(t.lotId)?.name || "—" : "Sans lot",
          state = `<small class="dly-state ${t.state}">${DELAY_STATE_LABEL[t.state]}</small>`,
          revLabel = t.state === "done" ? "réel" : "projeté",
          cause = direct
            ? `<b>${esc(delayCauseLabel(r.cause))}</b>`
            : `<span class="muted">Aucune cause propre</span><small>origine : ${esc(r.parentTask.name)} · ${esc(delayCauseLabel(r.rootCause))}</small>`,
          validation = !direct
            ? `<span class="muted">Sans objet</span><small>retard hérité</small>`
            : r.validation === "confirmed"
              ? pill("success", "Confirmée")
              : r.validation === "pending"
                ? pill("warning", "À confirmer")
                : `<span class="pill">Sans responsable désigné</span>`,
          consequence = r.descendantIds.length
            ? `<b>${r.descendantIds.length}</b> ${delayPlural(r.descendantIds.length, "intervention décalée", "interventions décalées")}<small>${esc(r.consequences.filter((c) => c.relation === "propagated").map((c) => c.name).join(", "))}</small>`
            : `<span class="muted">Aucune</span>`;
        return (
          `<tr class="dly-row" role="row" data-event="${r.id}" onclick="openDelayDetail('${r.id}')">` +
          `<td role="cell" data-label="Intervention"><button type="button" class="link dly-open" onclick="event.stopPropagation();openDelayDetail('${r.id}')" aria-label="Ouvrir le détail : ${esc(t.name)}">${esc(t.name)}</button>${state}</td>` +
          `<td role="cell" data-label="Lot">${esc(lotName)}</td>` +
          `<td role="cell" data-label="Dates initiales">${delayRange(t.base)}</td>` +
          `<td role="cell" data-label="Dates révisées ou réelles">${delayRange(t.rev)}<small>${revLabel}</small></td>` +
          `<td role="cell" data-label="Jours ouvrés"><b class="dly-days">+${r.days} j</b></td>` +
          `<td role="cell" data-label="Nature"><span class="dly-tag ${r.type}">${direct ? "Direct" : "Hérité"}</span></td>` +
          `<td role="cell" data-label="Cause">${cause}</td>` +
          `<td role="cell" data-label="Intervenants associés">${r.associatedIds.map((id) => esc(delayResName(id))).join("<br>")}</td>` +
          `<td role="cell" data-label="Responsabilité déclarée">${
            r.responsibleIds.length
              ? r.responsibleIds.map((id) => `<b>${esc(delayResName(id))}</b>`).join("<br>")
              : direct
                ? `<span class="muted">Aucune désignée</span>`
                : `<span class="muted">Sans objet</span>`
          }</td>` +
          `<td role="cell" data-label="Validation">${validation}</td>` +
          `<td role="cell" data-label="Conséquences">${consequence}</td>` +
          `</tr>`
        );
      }

      function renderDelays() {
        let p = project(app.ui.projectId),
          back = `<div class="project-top-row"><button class="link project-back-link" onclick="go('project')">← ${esc(p ? p.name : "Chantiers")}</button></div>`,
          banner = `<div class="dly-banner" role="note"><b>Prototype</b><span>Données de démonstration injectées pour valider l’ergonomie et les règles de lecture. Ces retards ne sont <u>pas calculés</u> par le moteur de planification de Kanvix.</span></div>`;
        if (!p) return back + banner + emptyState("Chantier introuvable", "Retournez à la liste des chantiers.");
        let fx = DELAY_FIXTURES.projects[p.id];
        if (!fx)
          return (
            back +
            header("Bilan des retards", esc(p.name)) +
            banner +
            emptyState(
              "Pas de bilan de démonstration pour ce chantier",
              "Ce prototype ne contient de données d’exemple que pour « Résidence Keravel ».",
              `<button class="btn" onclick="openDelaysBilan('keravel')">Voir Résidence Keravel</button>`,
            )
          );
        let model = buildDelayBilan(fx),
          k = model.kpis,
          errors = validateDelayFixture(fx),
          all = delaySortedRows(model),
          rows = filterDelayEvents(all, delaysView),
          kpi = (label, value, sub, tone = "") =>
            `<div class="dly-kpi ${tone}" role="group" aria-label="${esc(label)}"><small>${label}</small><b>${value}</b>${sub ? `<span>${sub}</span>` : ""}</div>`,
          actions = `<div class="team-actions"><button class="btn" onclick="downloadDelaysCSV()">Exporter en CSV</button><button class="btn" onclick="printDelays()">Imprimer / PDF</button></div>`;
        return (
          back +
          header("Bilan des retards", `${esc(p.name)} · ${esc(fx.label)}`, actions) +
          banner +
          (errors.length ? `<div class="dly-banner dly-error" role="alert"><b>Fixture invalide</b><span>${esc(errors.slice(0, 3).join(" ; "))}</span></div>` : "") +
          `<section class="dly-kpis" aria-label="Indicateurs du bilan">` +
          kpi("Fin initialement prévue", esc(fmtDay(k.baselineEnd + "T12:00"))) +
          kpi(k.projectedIsActual ? "Fin réelle" : "Fin projetée", esc(fmtDay(k.projectedEnd + "T12:00")), k.projectedIsActual ? "" : "d’après les dates révisées") +
          kpi("Retard net", `${k.netDelay} jour${delayPlural(k.netDelay, "", "s")} ouvré${delayPlural(k.netDelay, "", "s")}`, "dérive de la fin du chantier", k.netDelay > 0 ? "warn" : "ok") +
          kpi("Interventions en retard", `${k.lateCount} sur ${k.totalTasks}`) +
          kpi("Retards directs", String(k.direct), `${k.directDaysSum} j générés`) +
          kpi("Retards hérités", String(k.inherited), `${k.inheritedDaysSum} j subis, non recomptés`) +
          kpi("Attributions confirmées", String(k.confirmed), "désignées et validées", k.confirmed ? "ok" : "") +
          kpi("Attributions à confirmer", String(k.pending), "désignées, en attente", k.pending ? "warn" : "") +
          `</section>` +
          `<p class="dly-note">Le retard net mesure la dérive de la fin du chantier : ce n’est pas la somme des retards des interventions. Un retard hérité vient d’une intervention précédente et n’est <b>jamais recompté</b>. ${k.noResponsible} retard${delayPlural(k.noResponsible, "", "s")} direct${delayPlural(k.noResponsible, "", "s")} n’${delayPlural(k.noResponsible, "a", "ont")} aucun responsable désigné.</p>` +
          `<details class="dly-help"><summary>Comment lire ce bilan</summary><dl>` +
          `<dt>Intervenant associé</dt><dd>Personne ou entreprise affectée à l’intervention. Être associé ne signifie jamais être responsable du retard.</dd>` +
          `<dt>Retard direct</dt><dd>Retard réellement généré sur cette intervention.</dd>` +
          `<dt>Retard hérité</dt><dd>Intervention décalée à cause d’une intervention précédente. Elle ne porte aucune responsabilité.</dd>` +
          `<dt>Cause déclarée</dt><dd>Météo, approvisionnement, décision du client, erreur… saisie par un utilisateur.</dd>` +
          `<dt>Responsabilité déclarée</dt><dd>Désignée manuellement par un utilisateur habilité. Kanvix n’en déduit jamais.</dd>` +
          `<dt>À confirmer</dt><dd>Attribution proposée mais pas encore validée : à ne pas tenir pour établie.</dd>` +
          `<dt>Le filtre Cause</dt><dd>Suit l’origine du retard : un retard hérité porte la cause de son origine.</dd>` +
          `</dl></details>` +
          delayFilterBar(model) +
          `<p class="dly-count" role="status" aria-live="polite" id="dlyCount">${rows.length} retard${delayPlural(rows.length, "", "s")} affiché${delayPlural(rows.length, "", "s")} sur ${all.length}</p>` +
          (rows.length
            ? `<div class="dly-table-wrap"><table class="dly-table" role="table" aria-label="Retards du chantier" aria-describedby="dlyCount"><thead role="rowgroup"><tr role="row">${["Intervention", "Lot", "Dates initiales", "Dates révisées ou réelles", "Jours ouvrés", "Nature", "Cause", "Intervenants associés", "Responsabilité déclarée", "Validation", "Conséquences"]
                .map((h) => `<th role="columnheader" scope="col">${h}</th>`)
                .join("")}</tr></thead><tbody role="rowgroup">${rows.map(delayRowHTML).join("")}</tbody></table></div>`
            : `<div id="dlyEmpty">${emptyState("Aucun retard ne correspond à ces filtres", "Modifiez un filtre ou revenez à la liste complète.", `<button class="btn" onclick="resetDelayFilters()">Réinitialiser les filtres</button>`)}</div>`)
        );
      }

      /* ---- Panneau de détail (sidewindow) ---------------------------------- */
      function openDelayDetail(eventId) {
        let fx = DELAY_FIXTURES.projects[app.ui.projectId];
        if (!fx) return;
        let model = buildDelayBilan(fx),
          r = model.rows.find((x) => x.id === eventId);
        if (!r) return;
        let t = r.task,
          direct = r.type === "direct",
          root = model.rows.find((x) => x.id === r.rootId),
          lotName = t.lotId ? lot(t.lotId)?.name || "—" : "Sans lot",
          names = (ids) => ids.map((id) => esc(delayResName(id))),
          section = (title, body) => `<div class="drawer-section dly-sec"><h3>${title}</h3>${body}</div>`,
          resLink = (id) => `<button type="button" class="link" onclick="openResource('${id}')">${esc(delayResName(id))}</button>`,
          history = t.history
            .map(
              (h, i) =>
                `<li class="${i === t.history.length - 1 ? "is-current" : ""}"><b>${delayRange([h.start, h.end])}</b><span>${esc(h.label)}</span><small>${esc(fmtDay(h.at + "T12:00"))}${i === t.history.length - 1 ? " · dates retenues" : ""}</small></li>`,
            )
            .join(""),
          origin = direct
            ? `<p>Retard <b>généré sur cette intervention</b> : ${r.days} jour${delayPlural(r.days, "", "s")} ouvré${delayPlural(r.days, "", "s")} de dérive à la fin.</p>`
            : `<p>Intervention <b>décalée par « ${esc(r.parentTask.name)} »</b> (${r.parent.type === "direct" ? "retard direct" : "elle-même en retard hérité"}, +${r.parentTask.endSlip} j).</p>` +
              (root && root.id !== r.parent.id ? `<p class="muted">Origine première : « ${esc(root.task.name)} » — ${esc(delayCauseLabel(root.cause))}.</p>` : "") +
              `<div class="dly-links"><button type="button" class="btn small" onclick="openDelayDetail('${r.parent.id}')">Ouvrir l’origine</button>${root && root.id !== r.parent.id ? `<button type="button" class="btn small" onclick="openDelayDetail('${root.id}')">Ouvrir l’origine première</button>` : ""}</div>`,
          validation = !direct
            ? `<p class="muted">Sans objet : un retard hérité n’a pas d’attribution à valider.</p>`
            : r.validation === "confirmed"
              ? `<p>${pill("success", "Confirmée")}</p><p class="muted">Validée par ${esc(delayResName(r.validatedBy))} le ${esc(fmtDay(r.validatedAt + "T12:00"))}.</p>`
              : r.validation === "pending"
                ? `<p>${pill("warning", "À confirmer")}</p><p class="muted">Cette attribution n’a pas encore été validée : elle ne doit pas être tenue pour établie.</p>`
                : `<p><span class="pill">Sans responsable désigné</span></p><p class="muted">Aucune personne ni entreprise n’a été désignée pour ce retard.</p>`,
          consequences = r.consequences.length
            ? `<ul class="dly-cons">${r.consequences
                .map(
                  (c) =>
                    `<li><b>${esc(c.name)}</b><span>${
                      c.relation === "propagated"
                        ? `décalée de <b>+${c.days} j</b> par ce retard`
                        : c.relation === "other"
                          ? `décalée de +${c.days} j, mais par <b>une autre cause</b> : non attribuée à ce retard`
                          : "non décalée"
                    }</span></li>`,
                )
                .join("")}</ul>`
            : `<p class="muted">Aucune intervention ne dépend de celle-ci.</p>`,
          model_json = JSON.stringify(
            {
              id: r.id, projectId: app.ui.projectId, taskId: r.taskId, type: r.type, parentEventId: r.parentEventId, causeCode: r.cause,
              baseline: { start: t.base[0], end: t.base[1] }, revised: { start: t.rev[0], end: t.rev[1] },
              delayBusinessDays: r.days, comment: r.comment, associatedResourceIds: r.associatedIds, declaredResponsibleIds: r.responsibleIds,
              validation: r.validation, author: r.author, createdAt: r.declaredAt, validatedAt: r.validatedAt, attachments: r.attachments,
            },
            null,
            1,
          );
        $("#drawerContent").innerHTML =
          `<p class="muted">BILAN DES RETARDS · ${direct ? "RETARD DIRECT" : "RETARD HÉRITÉ"}</p>` +
          `<h2>${esc(t.name)}</h2>` +
          `<p class="dly-sub"><span class="dly-tag ${r.type}">${direct ? "Direct" : "Hérité"}</span> <b class="dly-days">+${r.days} j ouvrés</b> · ${esc(lotName)} · ${DELAY_STATE_LABEL[t.state]}</p>` +
          `<div class="dly-banner dly-banner-sm" role="note"><span>Prototype — données de démonstration.</span></div>` +
          section("Historique des dates", `<ol class="dly-history">${history}</ol>`) +
          section("Origine du décalage", origin) +
          section("Cause", direct ? `<p><b>${esc(delayCauseLabel(r.cause))}</b></p>` : `<p class="muted">Aucune cause propre : retard hérité. Cause de l’origine : <b>${esc(delayCauseLabel(r.rootCause))}</b>.</p>`) +
          section("Commentaire", `<p>${esc(r.comment)}</p>`) +
          section("Intervenants associés", `<p class="dly-chips">${r.associatedIds.map(resLink).join("")}</p><p class="muted small">Affectés à l’intervention. Être associé ne signifie pas être responsable du retard.</p>`) +
          section(
            "Responsabilité déclarée",
            r.responsibleIds.length
              ? `<p class="dly-chips">${r.responsibleIds.map(resLink).join("")}</p><p class="muted small">Désignée manuellement — non déduite par Kanvix.</p>`
              : direct
                ? `<p class="muted">Aucune responsabilité désignée.</p>`
                : `<p class="muted">Sans objet : l’intervenant qui subit un retard hérité n’en est pas responsable.</p>`,
          ) +
          section("Déclaration", `<p><b>${esc(delayResName(r.author))}</b> · ${esc(fmtDay(r.declaredAt + "T12:00"))}</p>`) +
          section("Statut de validation", validation) +
          section("Conséquences sur les tâches dépendantes", consequences) +
          `<details class="dly-adv"><summary>Informations avancées</summary>` +
          `<dl><dt>Identifiant</dt><dd>${esc(r.id)}</dd><dt>Événement parent</dt><dd>${esc(r.parentEventId || "—")}</dd><dt>Origine première</dt><dd>${esc(r.rootId)}</dd>` +
          `<dt>Dates initiales</dt><dd>${esc(t.base.join(" → "))}</dd><dt>Dates révisées ou réelles</dt><dd>${esc(t.rev.join(" → "))}</dd>` +
          `<dt>Décalage du début / de la fin</dt><dd>+${t.startSlip} j / +${t.endSlip} j ouvrés (week-ends et jours fériés exclus)</dd>` +
          `<dt>Pièces justificatives</dt><dd>${r.attachments.length ? r.attachments.map(esc).join("<br>") : "Aucune"}</dd></dl>` +
          `<p class="muted small">Enregistrement cible proposé (non implémenté dans le moteur) :</p><pre class="dly-json" tabindex="0">${esc(model_json)}</pre></details>` +
          `<div class="drawer-section actions"><button class="btn" onclick="closeOverlay('drawer')">Fermer</button></div>`;
        $("#drawer").classList.add("open");
      }

      /* ---- Export ---------------------------------------------------------- */
      function delayCurrentRows() {
        let model = delayModelFor(app.ui.projectId);
        return model ? { model, rows: filterDelayEvents(delaySortedRows(model), delaysView) } : null;
      }
      function downloadDelaysCSV() {
        let cur = delayCurrentRows();
        if (!cur) return toast("Aucun bilan à exporter pour ce chantier.");
        try {
          let csv = delaysToCSV(cur.model, cur.rows, delayResName),
            blob = new Blob([csv], { type: "text/csv;charset=utf-8" }),
            url = URL.createObjectURL(blob),
            a = document.createElement("a");
          a.href = url;
          a.download = `kanvix-bilan-retards-${app.ui.projectId}-${localDateKey(new Date())}.csv`;
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          toast(`Export CSV : ${cur.rows.length} ligne${delayPlural(cur.rows.length, "", "s")}`);
        } catch (error) {
          console.error("Kanvix: export CSV impossible", error);
          toast("Export impossible dans ce navigateur.");
        }
      }
      /* PDF : impression du navigateur, sur le modèle de exportPlanningPDF(). */
      function printDelays() {
        document.body.classList.add("delays-print");
        let previousTitle = document.title;
        document.title = `Kanvix - Bilan des retards - ${localDateKey(new Date())}`;
        let cleanup = () => {
          document.body.classList.remove("delays-print");
          document.title = previousTitle;
          window.removeEventListener("afterprint", cleanup);
        };
        window.addEventListener("afterprint", cleanup);
        setTimeout(() => window.print(), 80);
        setTimeout(cleanup, 30000);
      }
