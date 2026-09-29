      /* ================= V2.12.3 — ACTIVITÉS D'ENTREPRISE (noyau pur) ========
         Une PERSONNE a un métier (jobTitle, texte libre, inchangé). Une
         ENTREPRISE exerce 0, 1 ou PLUSIEURS activités : resource.activityLotIds
         est un tableau d'IDENTIFIANTS de lots du référentiel existant
         (app.lots, « lots / corps d'état », V2.6) — jamais une chaîne libre.
         Un seul catalogue : renommer « Plomberie » dans Réglages renomme
         l'activité partout, sans rien recopier.

         Ces fonctions sont PURES et n'utilisent ni `app` ni aucune constante
         globale : migrateState() s'exécute avant l'initialisation de `app`
         (let app = migrateState(load())). Ne rien y ajouter qui lise `app`. */
      function activityKey(s) {
        return String(s ?? "")
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
      }
      function activityCleanName(s) {
        return String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
      }
      function activitySlug(s) {
        return (
          activityKey(s)
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 40) || "activite"
        );
      }
      /* Lot portant ce nom, accents et casse ignorés. Un lot ACTIF est préféré ;
         à défaut un lot inactif (réutilisé tel quel, JAMAIS réactivé en silence). */
      function findActivityLot(lots, name) {
        let key = activityKey(name);
        if (!key) return null;
        let inactive = null;
        for (const l of lots || []) {
          if (activityKey(l.name) !== key) continue;
          if (l.active !== false) return l;
          inactive = inactive || l;
        }
        return inactive;
      }
      /* Réutilise le lot du même nom, sinon en crée UN dans le référentiel
         (id stable dérivé du nom). Point d'entrée unique, partagé par la
         migration et par le formulaire : les deux produisent le même lot. */
      function ensureActivityLot(lots, name, createdAt) {
        let clean = activityCleanName(name);
        if (!activityKey(clean)) return { lot: null, created: false };
        let found = findActivityLot(lots, clean);
        if (found) return { lot: found, created: false };
        let base = "lot-" + activitySlug(clean),
          id = base,
          n = 2;
        while (lots.some((l) => l.id === id)) id = base + "-" + n++;
        let created = {
          id,
          name: clean,
          colorKey: "slate",
          defaultTrade: "",
          order: lots.reduce((m, l) => Math.max(m, l.order ?? 0), 0) + 10,
          active: true,
          createdAt: createdAt || historyNow(),
        };
        lots.push(created);
        return { lot: created, created: true };
      }
      /* ---- MIGRATION V15 → V16 : les ACTIVITÉS D'ENTREPRISE ---------------
         Défensive, sans perte et IDEMPOTENTE : la rejouer sur un état déjà
         migré ne change rien (les IDs sont reconnus, aucun lot n'est recréé).
         Entrées acceptées pour une ENTREPRISE :
           - activityLotIds déjà tableau d'IDs (cas nominal) ;
           - ce même champ contenant des NOMS (import, édition à la main) ;
           - une chaîne « Électricité, Plomberie » (séparateurs , ; | retour) ;
           - un ancien champ d'activité unique ou multiple : activity,
             activities, trade, metier, specialty, specialties, jobTitle.
         Chaque nom est rapproché d'un lot existant (accents/casse ignorés,
         puis « métier indicatif » du lot s'il est sans ambiguïté), sinon un lot
         est créé : la valeur n'est jamais perdue. Doublons et vides éliminés.
         Un ID « lot-… » qui ne pointe sur rien n'est pas récupérable (il ne
         porte aucun nom) : il est retiré plutôt que conservé orphelin.
         Les anciens champs sont CONSOMMÉS (supprimés) : sinon une activité
         retirée par l'utilisateur reviendrait à la migration suivante.
         AUCUNE inférence : une entreprise sans activité reste à []. La démo
         appartient à INITIAL_STATE, pas à la migration. */
      function migrateCompanyActivities(value) {
        if (!Array.isArray(value.resources)) return;
        if (!Array.isArray(value.lots)) value.lots = [];
        const LEGACY = ["activities", "activity", "trade", "metier", "specialties", "specialty", "jobTitle"],
          LIMIT = 20;
        let lots = value.lots,
          known = new Set(lots.map((l) => l.id)),
          collect = (v, out) => {
            if (Array.isArray(v)) v.forEach((x) => collect(x, out));
            else if (typeof v === "string") v.split(/[,;|\n]+/).forEach((x) => out.push(x));
            else if (v && typeof v === "object")
              out.push(v.id && known.has(v.id) ? v.id : (v.name ?? v.label ?? ""));
            // tout autre type (nombre, booléen, null) n'est pas exploitable
          };
        value.resources.forEach((r) => {
          if (!r || r.type !== "company") return;
          let raw = [];
          collect(r.activityLotIds, raw);
          LEGACY.forEach((k) => {
            if (r[k] === undefined) return;
            collect(r[k], raw);
            delete r[k];
          });
          let ids = [],
            seen = new Set();
          for (const item of raw) {
            let token = String(item ?? "").trim();
            if (!token) continue;
            let id = null;
            if (known.has(token)) id = token;
            else {
              let f = findActivityLot(lots, token);
              if (!f && /^lot-[a-z0-9-]+$/.test(token)) continue; // ID orphelin
              if (!f) {
                let k = activityKey(token),
                  byTrade = lots.filter((l) => l.defaultTrade && activityKey(l.defaultTrade) === k);
                if (byTrade.length === 1) f = byTrade[0];
              }
              if (!f) f = ensureActivityLot(lots, token, historyNow()).lot;
              if (f) {
                id = f.id;
                known.add(f.id);
              }
            }
            if (id && !seen.has(id)) {
              seen.add(id);
              ids.push(id);
            }
            if (ids.length >= LIMIT) break;
          }
          r.activityLotIds = ids;
        });
      }
