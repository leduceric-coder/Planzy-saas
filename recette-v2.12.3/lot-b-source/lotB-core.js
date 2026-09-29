      /* ================= PROTOTYPE — BILAN DES RETARDS (noyau) ===============
         ⚠ PROTOTYPE DE VALIDATION MÉTIER. Rien ici n'est calculé par le moteur
         de planification : les interventions, leurs dates et leurs événements
         de retard sont des FIXTURES DE DÉMONSTRATION déterministes
         (DELAY_FIXTURES). Seuls les DÉRIVÉS (jours ouvrés, direct/hérité,
         indicateurs, conséquences) sont calculés, à partir de ces fixtures.

         ISOLEMENT. Ce bloc n'appelle aucune fonction du moteur transactionnel
         (planReflow, applyReflowPlan, planScheduleChanges, snapshot, undo…) et
         n'écrit jamais dans `app` : il LIT seulement le calendrier du produit
         (isNonWorkingDate) et le référentiel (lot, resource). Ses réglages de
         vue vivent hors de app.ui — rien de ce prototype n'est persisté.

         RÈGLE FONDAMENTALE — aucune conclusion automatique. Être AFFECTÉ à une
         intervention ne fait pas d'une personne ou d'une entreprise la cause de
         son retard. On distingue toujours :
           - intervenant ASSOCIÉ      : affecté à l'intervention (task.resourceIds) ;
           - retard DIRECT            : généré sur cette intervention ;
           - retard HÉRITÉ            : subi à cause d'une intervention précédente ;
           - CAUSE déclarée           : météo, approvisionnement, décision client… ;
           - RESPONSABILITÉ déclarée  : désignée À LA MAIN par un utilisateur ;
           - attribution À CONFIRMER  : déclarée mais pas encore validée.
         Un retard hérité ne porte JAMAIS de responsabilité et n'est JAMAIS
         recompté : le retard net du chantier n'est pas la somme des retards. */
      const DELAY_CAUSES = [
        ["weather", "Météo"],
        ["absence", "Absence"],
        ["supply", "Approvisionnement"],
        ["client", "Décision du client"],
        ["access", "Accès indisponible"],
        ["error", "Erreur"],
        ["breakdown", "Panne"],
        ["technical", "Aléa technique"],
        ["other", "Autre"],
      ];
      const DELAY_VALIDATION = {
        confirmed: "Confirmée",
        pending: "À confirmer",
        none: "Sans responsable désigné",
      };
      /* Fixtures. Dates au jour près (aaaa-mm-jj, inclusives). Septembre 2026
         ne contient aucun jour férié : l'arithmétique se vérifie à la main.
         Scénario obligatoire : le plaquiste termine avec 2 jours de retard, le
         Gall Électricité démarre 2 jours plus tard et SUBIT un retard hérité —
         il n'est pas responsable du retard initial. */
      const DELAY_FIXTURES = {
        kind: "demonstration",
        projects: {
          keravel: {
            label: "Second œuvre",
            baselineEnd: "2026-09-28",
            finalTaskId: "fx-recep",
            tasks: [
              { id: "fx-install", name: "Installation de chantier et protections", lotId: null, resourceIds: ["eric"], base: ["2026-09-07", "2026-09-07"], rev: ["2026-09-07", "2026-09-07"], state: "done", after: [],
                history: [{ at: "2026-09-04", label: "Planning initial", start: "2026-09-07", end: "2026-09-07" }] },
              { id: "fx-cloisons", name: "Pose des cloisons", lotId: "lot-platrerie", resourceIds: ["mathieu"], base: ["2026-09-07", "2026-09-11"], rev: ["2026-09-07", "2026-09-15"], state: "done", after: ["fx-install"],
                history: [
                  { at: "2026-09-04", label: "Planning initial", start: "2026-09-07", end: "2026-09-11" },
                  { at: "2026-09-10", label: "Fin repoussée : plaques de plâtre non livrées", start: "2026-09-07", end: "2026-09-15" },
                ] },
              { id: "fx-menuis", name: "Pose des menuiseries extérieures", lotId: "lot-menuiseries-ext", resourceIds: ["armor", "thomas"], base: ["2026-09-07", "2026-09-11"], rev: ["2026-09-07", "2026-09-16"], state: "done", after: ["fx-install"],
                history: [
                  { at: "2026-09-04", label: "Planning initial", start: "2026-09-07", end: "2026-09-11" },
                  { at: "2026-09-11", label: "Deux fenêtres à refaire", start: "2026-09-07", end: "2026-09-14" },
                  { at: "2026-09-14", label: "Repose reportée : nouvelle livraison", start: "2026-09-07", end: "2026-09-16" },
                ] },
              { id: "fx-reseaux", name: "Reprise des réseaux d’eau", lotId: "lot-plomberie", resourceIds: ["ouest-fluides", "marc"], base: ["2026-09-08", "2026-09-11"], rev: ["2026-09-08", "2026-09-15"], state: "done", after: ["fx-install"],
                history: [
                  { at: "2026-09-04", label: "Planning initial", start: "2026-09-08", end: "2026-09-11" },
                  { at: "2026-09-11", label: "Fuite découverte : tronçon à remplacer", start: "2026-09-08", end: "2026-09-15" },
                ] },
              { id: "fx-gaines", name: "Passage des gaines et câbles", lotId: "lot-electricite", resourceIds: ["legall"], base: ["2026-09-14", "2026-09-18"], rev: ["2026-09-16", "2026-09-22"], state: "done", after: ["fx-cloisons"],
                history: [
                  { at: "2026-09-04", label: "Planning initial", start: "2026-09-14", end: "2026-09-18" },
                  { at: "2026-09-10", label: "Démarrage décalé : cloisons terminées plus tard", start: "2026-09-16", end: "2026-09-22" },
                ] },
              { id: "fx-calfeut", name: "Calfeutrement et joints extérieurs", lotId: "lot-menuiseries-ext", resourceIds: ["thomas"], base: ["2026-09-14", "2026-09-15"], rev: ["2026-09-17", "2026-09-18"], state: "done", after: ["fx-menuis"],
                history: [
                  { at: "2026-09-04", label: "Planning initial", start: "2026-09-14", end: "2026-09-15" },
                  { at: "2026-09-14", label: "Démarrage décalé : menuiseries posées plus tard", start: "2026-09-17", end: "2026-09-18" },
                ] },
              { id: "fx-sanit", name: "Pose des sanitaires", lotId: "lot-sanitaire", resourceIds: ["ouest-fluides"], base: ["2026-09-14", "2026-09-16"], rev: ["2026-09-16", "2026-09-18"], state: "done", after: ["fx-reseaux"],
                history: [
                  { at: "2026-09-04", label: "Planning initial", start: "2026-09-14", end: "2026-09-16" },
                  { at: "2026-09-11", label: "Démarrage décalé : réseaux repris plus tard", start: "2026-09-16", end: "2026-09-18" },
                ] },
              { id: "fx-peinture", name: "Peinture des cloisons", lotId: "lot-peinture", resourceIds: ["coloris"], base: ["2026-09-21", "2026-09-25"], rev: ["2026-09-23", "2026-09-29"], state: "in_progress", after: ["fx-gaines"],
                history: [
                  { at: "2026-09-04", label: "Planning initial", start: "2026-09-21", end: "2026-09-25" },
                  { at: "2026-09-18", label: "Démarrage décalé : gaines terminées plus tard", start: "2026-09-23", end: "2026-09-29" },
                ] },
              { id: "fx-facades", name: "Peinture des façades", lotId: "lot-peinture", resourceIds: ["coloris"], base: ["2026-09-21", "2026-09-23"], rev: ["2026-09-21", "2026-09-24"], state: "done", after: ["fx-calfeut"],
                history: [
                  { at: "2026-09-04", label: "Planning initial", start: "2026-09-21", end: "2026-09-23" },
                  { at: "2026-09-24", label: "Fin repoussée : pluie", start: "2026-09-21", end: "2026-09-24" },
                ] },
              { id: "fx-cuisine", name: "Pose de la cuisine", lotId: null, resourceIds: ["thomas"], base: ["2026-09-21", "2026-09-24"], rev: ["2026-09-28", "2026-10-01"], state: "in_progress", after: ["fx-sanit", "fx-calfeut"],
                history: [
                  { at: "2026-09-04", label: "Planning initial", start: "2026-09-21", end: "2026-09-24" },
                  { at: "2026-09-18", label: "Report : nouveau modèle choisi par le client", start: "2026-09-28", end: "2026-10-01" },
                ] },
              { id: "fx-recep", name: "Réception des travaux", lotId: null, resourceIds: ["eric"], base: ["2026-09-28", "2026-09-28"], rev: ["2026-10-02", "2026-10-02"], state: "planned", after: ["fx-peinture", "fx-facades", "fx-cuisine"],
                history: [
                  { at: "2026-09-04", label: "Planning initial", start: "2026-09-28", end: "2026-09-28" },
                  { at: "2026-09-18", label: "Reportée : la cuisine se termine plus tard", start: "2026-10-02", end: "2026-10-02" },
                ] },
            ],
            events: [
              { id: "ev-cloisons", taskId: "fx-cloisons", type: "direct", parentEventId: null, cause: "supply",
                comment: "Plaques de plâtre livrées avec 2 jours de retard : la pose a été interrompue, la fin repoussée de 2 jours ouvrés.",
                responsibleIds: [], validation: "none", author: "eric", declaredAt: "2026-09-10", validatedBy: null, validatedAt: null,
                attachments: ["Bon de livraison du 10-09.pdf"] },
              { id: "ev-menuis", taskId: "fx-menuis", type: "direct", parentEventId: null, cause: "error",
                comment: "Deux fenêtres livrées à la mauvaise cote : refabrication puis repose.",
                responsibleIds: ["armor"], validation: "confirmed", author: "eric", declaredAt: "2026-09-14", validatedBy: "eric", validatedAt: "2026-09-17",
                attachments: ["Mail Menuiserie Armor du 15-09.pdf", "Bon de commande rev. B.pdf"] },
              { id: "ev-reseaux", taskId: "fx-reseaux", type: "direct", parentEventId: null, cause: "technical",
                comment: "Fuite découverte sur la colonne existante : purge et remplacement d’un tronçon. L’origine de la fuite (réseau existant ou intervention) reste à établir.",
                responsibleIds: ["ouest-fluides"], validation: "pending", author: "eric", declaredAt: "2026-09-11", validatedBy: null, validatedAt: null,
                attachments: [] },
              { id: "ev-facades", taskId: "fx-facades", type: "direct", parentEventId: null, cause: "weather",
                comment: "Pluie continue les 22 et 23 septembre : application impossible.",
                responsibleIds: [], validation: "none", author: "eric", declaredAt: "2026-09-24", validatedBy: null, validatedAt: null,
                attachments: [] },
              { id: "ev-cuisine", taskId: "fx-cuisine", type: "direct", parentEventId: null, cause: "client",
                comment: "Le client a changé de modèle de cuisine le 18 septembre : la pose n’a pu démarrer qu’après réception du nouveau plan.",
                responsibleIds: [], validation: "none", author: "eric", declaredAt: "2026-09-18", validatedBy: null, validatedAt: null,
                attachments: ["Mail du client du 18-09.pdf"] },
              { id: "ev-gaines", taskId: "fx-gaines", type: "inherited", parentEventId: "ev-cloisons", cause: null,
                comment: "Démarrage décalé de 2 jours : les cloisons, à équiper, se sont terminées avec 2 jours de retard.",
                responsibleIds: [], validation: "none", author: "eric", declaredAt: "2026-09-10", validatedBy: null, validatedAt: null, attachments: [] },
              { id: "ev-calfeut", taskId: "fx-calfeut", type: "inherited", parentEventId: "ev-menuis", cause: null,
                comment: "Démarrage décalé de 3 jours : les menuiseries ont été posées 3 jours plus tard.",
                responsibleIds: [], validation: "none", author: "eric", declaredAt: "2026-09-14", validatedBy: null, validatedAt: null, attachments: [] },
              { id: "ev-sanit", taskId: "fx-sanit", type: "inherited", parentEventId: "ev-reseaux", cause: null,
                comment: "Démarrage décalé de 2 jours : la reprise des réseaux s’est terminée avec 2 jours de retard.",
                responsibleIds: [], validation: "none", author: "eric", declaredAt: "2026-09-11", validatedBy: null, validatedAt: null, attachments: [] },
              { id: "ev-peinture", taskId: "fx-peinture", type: "inherited", parentEventId: "ev-gaines", cause: null,
                comment: "Démarrage décalé de 2 jours : le passage des gaines s’est terminé avec 2 jours de retard.",
                responsibleIds: [], validation: "none", author: "eric", declaredAt: "2026-09-18", validatedBy: null, validatedAt: null, attachments: [] },
              { id: "ev-recep", taskId: "fx-recep", type: "inherited", parentEventId: "ev-cuisine", cause: null,
                comment: "Réception reportée de 4 jours ouvrés : elle attend la fin de la pose de la cuisine, dernière intervention à se terminer.",
                responsibleIds: [], validation: "none", author: "eric", declaredAt: "2026-09-18", validatedBy: null, validatedAt: null, attachments: [] },
            ],
          },
        },
      };

      /* ---- Jours ouvrés : LECTURE SEULE du calendrier du produit ---------- */
      function delayAddDays(key, n) {
        let d = new Date(key + "T12:00");
        d.setDate(d.getDate() + n);
        return localDateKey(d);
      }
      /* Nombre de jours ouvrés (week-ends et jours fériés français exclus)
         séparant deux jours : de `from` (exclu) à `to` (inclus). Signé. */
      function delayBD(from, to) {
        if (!from || !to || from === to) return 0;
        let sign = to > from ? 1 : -1,
          a = sign > 0 ? from : to,
          b = sign > 0 ? to : from,
          cur = a,
          n = 0;
        for (let guard = 0; guard < 800 && cur < b; guard++) {
          cur = delayAddDays(cur, 1);
          if (!isNonWorkingDate(cur)) n++;
        }
        return sign * n;
      }
      function delayCauseLabel(code) {
        return (DELAY_CAUSES.find((c) => c[0] === code) || [null, "—"])[1];
      }

      /* ---- Calcul du bilan : PUR, ne lit que les fixtures fournies --------- */
      function buildDelayBilan(fx) {
        let tasks = new Map(),
          events = new Map();
        fx.tasks.forEach((t) => {
          tasks.set(t.id, {
            ...t,
            startSlip: delayBD(t.base[0], t.rev[0]),
            endSlip: delayBD(t.base[1], t.rev[1]),
          });
        });
        fx.events.forEach((e) => events.set(e.id, { ...e }));
        let byTask = new Map([...events.values()].map((e) => [e.taskId, e]));
        let rootOf = (e) => {
          let cur = e,
            seen = new Set();
          while (cur.parentEventId && events.has(cur.parentEventId) && !seen.has(cur.id)) {
            seen.add(cur.id);
            cur = events.get(cur.parentEventId);
          }
          return cur;
        };
        let rows = [...events.values()].map((e) => {
          let t = tasks.get(e.taskId),
            root = rootOf(e),
            days = t ? t.endSlip : 0,
            parent = e.parentEventId ? events.get(e.parentEventId) : null,
            // Conséquences : les interventions qui DÉPENDENT de celle-ci.
            successors = [...tasks.values()].filter((x) => (x.after || []).includes(e.taskId)),
            consequences = successors.map((s) => {
              let se = byTask.get(s.id);
              return {
                taskId: s.id,
                name: s.name,
                days: s.endSlip,
                // décalée PAR cette cause / décalée par une AUTRE cause / non décalée
                relation: se && se.parentEventId === e.id ? "propagated" : s.endSlip > 0 ? "other" : "none",
              };
            }),
            descendants = [];
          let walk = (id) =>
            [...events.values()]
              .filter((x) => x.parentEventId === id)
              .forEach((c) => {
                descendants.push(c);
                walk(c.id);
              });
          walk(e.id);
          return {
            ...e,
            task: t,
            days,
            directDays: e.type === "direct" ? days : 0,
            inheritedDays: e.type === "inherited" ? days : 0,
            rootId: root.id,
            rootCause: root.cause,
            parent,
            parentTask: parent ? tasks.get(parent.taskId) : null,
            associatedIds: t ? [...t.resourceIds] : [],
            consequences,
            descendantIds: descendants.map((d) => d.id),
            propagatedDays: descendants.length ? descendants.reduce((n, d) => n + (tasks.get(d.taskId)?.endSlip || 0), 0) : 0,
          };
        });
        let finalTask = tasks.get(fx.finalTaskId),
          projectedEnd = finalTask ? finalTask.rev[1] : null,
          late = [...tasks.values()].filter((t) => t.endSlip > 0),
          direct = rows.filter((r) => r.type === "direct"),
          inherited = rows.filter((r) => r.type === "inherited");
        return {
          fx,
          tasks,
          rows,
          kpis: {
            baselineEnd: fx.baselineEnd,
            projectedEnd,
            projectedIsActual: finalTask ? finalTask.state === "done" : false,
            // Le retard NET est la dérive de la fin du chantier — jamais une somme.
            netDelay: delayBD(fx.baselineEnd, projectedEnd),
            lateCount: late.length,
            totalTasks: tasks.size,
            direct: direct.length,
            inherited: inherited.length,
            confirmed: direct.filter((r) => r.validation === "confirmed").length,
            pending: direct.filter((r) => r.validation === "pending").length,
            noResponsible: direct.filter((r) => !r.responsibleIds.length).length,
            // Informatif : les jours hérités ne s'ajoutent JAMAIS aux jours générés.
            directDaysSum: direct.reduce((n, r) => n + r.directDays, 0),
            inheritedDaysSum: inherited.reduce((n, r) => n + r.inheritedDays, 0),
          },
        };
      }

      /* Invariants de cohérence d'une fixture. Retourne la liste des écarts
         (vide = fixture saine). Sert de garde-fou à toute évolution des données. */
      function validateDelayFixture(fx) {
        let errs = [],
          m = buildDelayBilan(fx),
          evByTask = new Map(m.rows.map((r) => [r.taskId, r]));
        m.tasks.forEach((t) => {
          if (t.endSlip > 0 && !evByTask.has(t.id)) errs.push(`${t.id} : retard de ${t.endSlip} j sans événement`);
          if (t.endSlip <= 0 && evByTask.has(t.id)) errs.push(`${t.id} : événement sur une intervention à l’heure`);
          if (t.startSlip < 0) errs.push(`${t.id} : démarre avant la date prévue`);
        });
        m.rows.forEach((r) => {
          if (!r.task) return errs.push(`${r.id} : intervention inconnue`);
          if (r.type === "direct") {
            if (r.parentEventId) errs.push(`${r.id} : un retard direct n’a pas de parent`);
            if (!r.cause) errs.push(`${r.id} : un retard direct doit avoir une cause`);
          } else {
            if (!r.parent) errs.push(`${r.id} : un retard hérité doit avoir un événement parent`);
            else {
              if (!(r.task.after || []).includes(r.parent.taskId)) errs.push(`${r.id} : le parent n’est pas un prédécesseur`);
              if (r.days > (r.parentTask?.endSlip ?? 0)) errs.push(`${r.id} : hérite de plus de jours (${r.days}) que son parent (${r.parentTask?.endSlip})`);
              if (r.task.rev[0] <= (r.parentTask?.rev[1] ?? "")) errs.push(`${r.id} : démarre avant la fin révisée de son prédécesseur`);
            }
            if (r.responsibleIds.length) errs.push(`${r.id} : un retard hérité ne porte jamais de responsabilité`);
            if (r.validation !== "none") errs.push(`${r.id} : un retard hérité n’a pas d’attribution à valider`);
          }
          if (r.responsibleIds.length && !["confirmed", "pending"].includes(r.validation)) errs.push(`${r.id} : responsabilité déclarée sans statut de validation`);
          if (!r.responsibleIds.length && r.validation !== "none") errs.push(`${r.id} : statut de validation sans responsable désigné`);
        });
        // Double comptage : la fin du chantier ne peut pas dériver de plus que
        // le plus long retard direct.
        let maxDirect = Math.max(0, ...m.rows.filter((r) => r.type === "direct").map((r) => r.directDays));
        if (m.kpis.netDelay > maxDirect) errs.push(`retard net (${m.kpis.netDelay}) supérieur au plus long retard direct (${maxDirect})`);
        return errs;
      }

      /* ---- Filtres (purs) -------------------------------------------------- */
      function filterDelayEvents(rows, f) {
        return rows.filter((r) => {
          if (f.type && f.type !== "all" && r.type !== f.type) return false;
          // La cause suit l'ORIGINE : un retard hérité porte la cause de sa racine.
          if (f.cause && f.cause !== "all" && r.rootCause !== f.cause) return false;
          let involved = new Set([...r.associatedIds, ...r.responsibleIds]);
          if (f.company && f.company !== "all" && !involved.has(f.company)) return false;
          if (f.person && f.person !== "all" && !involved.has(f.person)) return false;
          if (f.attribution && f.attribution !== "all") {
            // L'attribution ne concerne que les retards DIRECTS : un retard hérité
            // n'est ni « confirmé », ni « à confirmer », ni « sans responsable ».
            if (r.type !== "direct") return false;
            if (f.attribution === "none") return !r.responsibleIds.length;
            if (r.validation !== f.attribution) return false;
          }
          return true;
        });
      }

      /* ---- Export CSV (pur) ------------------------------------------------ */
      function delayCsvCell(v) {
        let s = String(v ?? "");
        // Neutralise l'interprétation d'une formule par un tableur.
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }
      function delaysToCSV(model, rows, nameOf) {
        let head = ["Intervention", "Lot", "Début prévu", "Fin prévue", "Début révisé ou réel", "Fin révisée ou réelle", "Jours ouvrés de retard", "Nature", "Cause", "Origine (retard hérité)", "Intervenants associés", "Responsabilité déclarée", "Statut de validation", "Conséquences propagées", "Déclaré par", "Déclaré le"],
          cause = (r) => (r.type === "direct" ? delayCauseLabel(r.cause) : "Hérité (" + delayCauseLabel(r.rootCause) + ")"),
          lines = rows.map((r) =>
            [
              r.task.name,
              r.task.lotId ? lot(r.task.lotId)?.name || "" : "Sans lot",
              r.task.base[0],
              r.task.base[1],
              r.task.rev[0],
              r.task.rev[1],
              r.days,
              r.type === "direct" ? "Direct" : "Hérité",
              cause(r),
              r.parentTask ? r.parentTask.name : "",
              r.associatedIds.map(nameOf).join(" + "),
              r.responsibleIds.length ? r.responsibleIds.map(nameOf).join(" + ") : "",
              r.type === "direct" ? DELAY_VALIDATION[r.validation] : "Sans objet (retard hérité)",
              r.descendantIds.length ? `${r.descendantIds.length} intervention(s) décalée(s)` : "Aucune",
              nameOf(r.author),
              r.declaredAt,
            ]
              .map(delayCsvCell)
              .join(";"),
          );
        // BOM UTF-8 + séparateur « ; » : s'ouvre correctement dans Excel en français.
        return "﻿" + [head.map(delayCsvCell).join(";"), ...lines].join("\r\n") + "\r\n";
      }
