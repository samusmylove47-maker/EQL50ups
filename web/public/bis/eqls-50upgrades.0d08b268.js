var EQLS50Upgrades = (function(exports) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	/**
	* Worn equipment positions, validated against a live `/outputfile inventory`.
	* Eighteen slot types occupying twenty-one positions, plus the two EQL-specific
	* "Any Slot" positions for twenty-three total.
	*/
	var SLOT_TYPES = [
		"EAR",
		"HEAD",
		"FACE",
		"NECK",
		"SHOULDERS",
		"ARMS",
		"BACK",
		"WRIST",
		"RANGE",
		"HANDS",
		"PRIMARY",
		"SECONDARY",
		"FINGERS",
		"CHEST",
		"LEGS",
		"FEET",
		"WAIST",
		"AMMO"
	];
	/** Slot types occupying more than one position on the character. */
	var DOUBLED_SLOTS = /* @__PURE__ */ new Set([
		"EAR",
		"WRIST",
		"FINGERS"
	]);
	function buildPositions() {
		const labels = {
			EAR: "Ear",
			HEAD: "Head",
			FACE: "Face",
			NECK: "Neck",
			SHOULDERS: "Shoulders",
			ARMS: "Arms",
			BACK: "Back",
			WRIST: "Wrist",
			RANGE: "Range",
			HANDS: "Hands",
			PRIMARY: "Primary",
			SECONDARY: "Secondary",
			FINGERS: "Fingers",
			CHEST: "Chest",
			LEGS: "Legs",
			FEET: "Feet",
			WAIST: "Waist",
			AMMO: "Ammo"
		};
		const out = [];
		for (const type of SLOT_TYPES) {
			const count = DOUBLED_SLOTS.has(type) ? 2 : 1;
			for (let i = 0; i < count; i++) out.push({
				id: count > 1 ? `${type}_${i + 1}` : type,
				type,
				label: count > 1 ? `${labels[type]} ${i + 1}` : labels[type],
				index: i
			});
		}
		for (let i = 0; i < 2; i++) out.push({
			id: `ANY_${i + 1}`,
			type: "ANY",
			label: `Any Slot ${i + 1}`,
			index: i
		});
		return out;
	}
	var SLOT_POSITIONS = buildPositions();
	SLOT_POSITIONS.length;
	/**
	* Items whose wiki era says they are out of era and which a live client
	* demonstrably holds anyway — **the era-purge rescue list, and nothing else.**
	*
	* The pipeline ships an item only if its era is pre-Kunark or its name appears
	* here; everything else is quarantined into `pipeline/quarantine.json`. So this
	* list is not an un-gating of hidden rows any more — it is the sole reason
	* thirteen Kunark items and the Shadow Rage set are in the catalog at all.
	*
	* **It is not the set of items seen in the live game, and no screen may read it
	* as one.** It was read that way once, and the result was the worst provenance
	* bug this project has had: `ItemWindow` printed "TIER M · CONFIRMED IN THE
	* LIVE GAME" over Orb of Tishan's wiki stat block — the export carries names
	* and ids, no stat values at all — while Earthshaker, whose numbers are the one
	* stat block checked digit-for-digit against a client window, printed nothing.
	* The strongest label in the vocabulary sat on Tier 2 data and was absent from
	* the best evidence in the project.
	*
	* The two facts that list was standing in for now ship on every catalog record,
	* computed by the pipeline from the files that actually carry them:
	*
	*   `item.ex` — existence: the name resolves to a line in the live inventory
	*               export, or the player named it. Proves the item is in the game.
	*   `item.sd` — standing: where the numbers on the row came from, including
	*               `tier-M` for the five stat blocks a client window confirmed.
	*
	* Read those. This list stays because it documents *why* nineteen out-of-era
	* items are in the catalog, and `data/source-standing.test.ts` holds it to that
	* job — every name in it must be out of era and must carry `ex`.
	*
	* Nothing is inferred from an item's neighbours, its zone or its era. Every
	* name is grouped below by the evidence that put it there, so a reader can see
	* exactly what each one rests on. Extend it the same way: with evidence, never
	* with a guess.
	*/
	/**
	* Seen in `research/validation/tier0-inventory-Avenrae.txt`, a live
	* `/outputfile inventory` export: the character possesses these in the running
	* game. `Hamed's Ring of Tears` is worn on a finger; `Tobrin's Mystical
	* Eyepatch` and `Selo`s Drums of the March` are socketed into worn gear;
	* `Shadow Rage Helm` is worn on the head and the other three Shadow Rage pieces
	* are banked.
	*/
	var TIER0_OBSERVED_IN_EXPORT = [
		"Batskull Earring",
		"Crystalline Spear",
		"Dragon Bone Bracelet",
		"Gauntlets of Fiery Might",
		"Gold Plated Koshigatana",
		"Hamed's Ring of Tears",
		"Hierophant`s Crook",
		"McVaxius` Horn of War",
		"Orb of Tishan",
		"Selo`s Drums of the March",
		"Shadow Rage Boots",
		"Shadow Rage Gloves",
		"Shadow Rage Helm",
		"Shadow Rage Sleeves",
		"Shadow Rage Wristguard",
		"Tobrin's Mystical Eyepatch",
		"Warhammer of Divine Grace",
		"White Satin Gloves"
	];
	/**
	* Named by the player who plays the game, which is the same Tier 0 authority as
	* a client screenshot and outranks any wiki page.
	*
	* > "Shadow rage is the berserker set from plane of fear and plane of hate that
	* > was added for EQ legends, to be in line with the other planar class gear
	* > sets."   — player report, 2026-08-17
	*
	* That places the whole set in the live game, so the one piece of it the export
	* does not happen to contain ships on the report rather than being quarantined
	* as the only absent member of a set whose other five are in the catalog. This
	* is the weakest evidence in this file and it is deliberately kept apart here
	* rather than blended into the list above. It does **not** extend to the other
	* 53 `FearHateRevamp` items, which were quarantined:
	* see research/validation/TIER0-PLAYER-REPORTS.md.
	*/
	var TIER0_REPORTED_BY_PLAYER = ["Shadow Rage Leggings"];
	new Set([...TIER0_OBSERVED_IN_EXPORT, ...TIER0_REPORTED_BY_PLAYER].map((name) => name.toLowerCase()));
	//#endregion
	//#region src/engine/character.ts
	function isUnrestricted(list) {
		return list.length === 0 || list.includes("ALL");
	}
	/**
	* `ALL_EXCEPT` marks a list whose remaining entries are exclusions rather than
	* inclusions, mirroring the wiki's "ALL except X" phrasing.
	*/
	function matchesList(list, candidates) {
		if (isUnrestricted(list)) return true;
		if (list.includes("NONE")) return false;
		if (list.includes("ALL_EXCEPT")) {
			const excluded = list.filter((v) => v !== "ALL_EXCEPT");
			return candidates.some((c) => !excluded.includes(c));
		}
		return candidates.some((c) => list.includes(c));
	}
	/** An item is usable when any one of the loadout's classes qualifies. */
	function canUseClass(item, ctx) {
		return matchesList(item.classes, ctx.classes);
	}
	function canUseRace(item, ctx) {
		if (isUnrestricted(item.races)) return true;
		if (item.races.includes("NONE")) return false;
		if (!ctx.race) return true;
		return matchesList(item.races, [ctx.race]);
	}
	//#endregion
	//#region src/engine/bis.ts
	/**
	* MAKE ME BIS — candidate enumeration.
	*
	* Implements `web/src/engine/bis-contract.ts`. Read that first: it carries the
	* seam, the field meanings and the two limits this catalogue has.
	*
	* **This module answers exactly one question: what could this character equip
	* that is better on some axis than what they hold?** It does not rank, does not
	* model damage, and does not decide what matters. Those are the gap engine's.
	*
	* ## Three rules it will not break
	*
	* 1. **Never invent a number.** A stat nobody recorded is reported in
	*    `statDelta.unknown`, never as a zero. `A zero is a claim.`
	* 2. **Never offer an item the character cannot wear.** Eligibility is computed
	*    with `engine/character.ts`'s own predicates, not a second copy of them —
	*    recommending unequippable gear is the failure that loses trust in one
	*    click.
	* 3. **Never assert obtainability we do not have.** `difficulty` is always
	*    `null` and unknown actionability is `'unknown'`, never `false`.
	*/
	/**
	* The level gate is SUPPLIED, not derived, and that is deliberate.
	*
	* `engine/character.ts`'s `levelCheck` takes the HIGHEST qualifying class
	* level. `research/eql-game-systems.md:279` says the effective level is the
	* LOWEST. **That contradiction is unresolved** — it is finding 5 in `HANDOFF.md`
	* and it is blocked on the capture in `research/validation/CAPTURE-REQUESTS.md`
	* §2. Deriving the gate here would silently pick a side in a dispute this
	* module has no evidence to settle, on the one field the brief calls the hard
	* part.
	*
	* So `BisInput.level` is the gate and the caller owns it. That is honest, and
	* it means the answer changes with the rule rather than baking one in.
	*/
	function meetsSuppliedLevel(item, level) {
		const required = Number.isFinite(item.rl) ? Math.max(0, Math.trunc(item.rl)) : 0;
		return required === 0 || level >= required;
	}
	function eligibility(item, ctx, level) {
		const restrictions = {
			classes: item.cl ?? [],
			races: item.ra ?? []
		};
		if (!canUseClass(restrictions, ctx)) return {
			eligible: false,
			reason: `no class in the trio may use it (${(item.cl ?? []).join("/") || "none listed"})`
		};
		if (!canUseRace(restrictions, ctx)) return {
			eligible: false,
			reason: `race ${ctx.race ?? "unset"} may not use it`
		};
		if (!meetsSuppliedLevel(item, level)) return {
			eligible: false,
			reason: `requires level ${item.rl}, trio is gated at ${level}`
		};
		return {
			eligible: true,
			reason: ""
		};
	}
	/** Every stat key either side carries, so a missing value is visible as missing. */
	function statKeys(a, b) {
		const keys = /* @__PURE__ */ new Set();
		for (const item of [a, b]) {
			if (!item) continue;
			for (const k of Object.keys(item.st ?? {})) keys.add(k);
			for (const k of Object.keys(item.sv ?? {})) keys.add(`SV_${k}`);
		}
		return [...keys];
	}
	function statValue(item, key) {
		if (!item) return 0;
		if (key.startsWith("SV_")) return item.sv?.[key.slice(3)];
		return item.st?.[key];
	}
	/**
	* The difference between a candidate and what is worn, with the unknowns named.
	*
	* `statsUnknown` on the candidate means the catalogue knows the item exists and
	* nothing about what it does — the whole comparison is unavailable, not partial,
	* and it must not read as "no change".
	*/
	function statDelta(candidate, worn) {
		const candidateStatsUnknown = Boolean(candidate.statsUnknown) || !Object.keys(candidate.st ?? {}).length && !Object.keys(candidate.sv ?? {}).length;
		if (worn === "unresolved") return {
			delta: {},
			unknown: statKeys(candidate, null).sort(),
			candidateStatsUnknown,
			replacesUnresolved: true
		};
		const delta = {};
		const unknown = [];
		for (const key of statKeys(candidate, worn)) {
			const to = statValue(candidate, key);
			const from = statValue(worn, key);
			if (to === void 0 || from === void 0) {
				unknown.push(key);
				continue;
			}
			const diff = to - from;
			if (diff !== 0) delta[key] = diff;
		}
		return {
			delta,
			unknown: unknown.sort(),
			candidateStatsUnknown,
			replacesUnresolved: false
		};
	}
	/** Is the candidate better on ANY axis? Unknowns do not count as better. */
	function betterOnSomeAxis(d) {
		return Object.values(d.delta).some((v) => v > 0);
	}
	/**
	* A zone string the wiki wrote as a note rather than as a place.
	*
	* The same test as `pipeline/contamination.mjs` signature 11
	* `removed-from-game` — deliberately the same regex, not a paraphrase of it.
	* That scanner finds 1 record in the shipped catalogue: `Basoon Haste
	* Gauntlets`, whose `src.z` is `["ITEM REMOVED FROM GAME"]`.
	*
	* The payload keeps the note ON PURPOSE — the scanner's own `markRule` says
	* the wiki's note survives and is rendered as if it were a place you could go,
	* and making that visible is the point. **But it must not cross this seam.**
	* `zones` is the key =Lockouts looks a raid up by, and "ITEM REMOVED FROM
	* GAME" is not a raid; passing it would put a garbage key into another
	* session's lookup. Filtered here rather than in the payload, because the
	* payload's decision to show it is correct for a reader and wrong for a
	* machine.
	*/
	var NOT_A_PLACE = /removed from game/i;
	/**
	* A mob name folded to a key another repository can join on.
	*
	* **Case only.** Measured 2026-09-01 over 2,315 distinct `src.m` strings:
	* **90 differ from another only by case** — `"a magician"` / `"A Magician"`,
	* `"The gnoll high shaman"` / `"the gnoll high shaman"`. EQ capitalises a
	* leading article line-initially and not mid-sentence, so the case is a
	* property of where the name was written down, not of the mob. Folding it is
	* lossless and it collapses one mob's two keys into one.
	*
	* **What is deliberately NOT folded: the leading article.** 35 further strings
	* differ only by `a` / `an` / `the` — `"a goblin warrior"` against
	* `"goblin warrior"` — and stripping it would be a claim that those name the
	* same creature. That is a mechanism claim about the game, and every reversal
	* this project logged last night was a mechanism claim. It is filed in
	* `docs/UNREPORTED-FINDINGS.md` as unresolved rather than silently merged.
	*
	* `mobs` keeps every string verbatim; this only ADDS a joinable key beside it,
	* so nothing a consumer already reads changes.
	*/
	function mobKey(name) {
		return String(name).trim().toLowerCase();
	}
	function obtainability(item, surveyed) {
		const src = item.src;
		const zones = (src?.z ?? []).filter((z) => !NOT_A_PLACE.test(String(z)));
		const mobs = src?.m ?? [];
		const quests = src?.q ?? [];
		const vendors = src?.v ?? [];
		const crafted = Boolean(src?.c);
		const measuredDrop = Array.isArray(item.ms) && item.ms.length > 0;
		if (!zones.length && !mobs.length && !quests.length && !vendors.length && !crafted && !measuredDrop) return {
			obtainable: "not recorded",
			actionability: "no-source"
		};
		const hit = zones.map((z) => surveyed.get(String(z).toLowerCase())).find((z) => z?.levels);
		return {
			obtainable: {
				zones,
				mobs,
				quests,
				vendors,
				crafted,
				measuredDrop,
				mobKeys: [...new Set(mobs.map(mobKey))],
				difficulty: null,
				zoneLevels: hit?.levels ?? null
			},
			actionability: "not-yet-asked"
		};
	}
	var POSITIONS_BY_TYPE = /* @__PURE__ */ new Map();
	for (const position of SLOT_POSITIONS) {
		const bucket = POSITIONS_BY_TYPE.get(position.type) ?? [];
		bucket.push(position.id);
		POSITIONS_BY_TYPE.set(position.type, bucket);
	}
	/**
	* Every eligible item that beats what is worn, for every slot position.
	*
	* **Unordered.** The array order is an enumeration artefact — see the contract.
	*/
	function candidates(input, catalog, options = {}) {
		const ctx = {
			classes: input.classes,
			race: input.race,
			levels: {}
		};
		const surveyed = /* @__PURE__ */ new Map();
		for (const z of options.surveyedZones ?? []) surveyed.set(z.title.toLowerCase(), z);
		const byId = options.byId ?? /* @__PURE__ */ new Map();
		const out = [];
		for (const item of catalog) {
			if (!eligibility(item, ctx, input.level).eligible) continue;
			for (const slot of item.sl ?? []) for (const positionId of POSITIONS_BY_TYPE.get(slot) ?? []) {
				const wornId = input.currentGear[positionId] ?? null;
				const worn = wornId ? byId.get(wornId) ?? "unresolved" : null;
				if (worn !== "unresolved" && worn && worn.n === item.n) continue;
				const d = statDelta(item, worn);
				if (!d.candidateStatsUnknown && !d.replacesUnresolved && !betterOnSomeAxis(d)) continue;
				const { obtainable, actionability } = obtainability(item, surveyed);
				out.push({
					slot,
					positionId,
					candidateItemId: item.id ?? null,
					candidateName: item.n,
					replacesItemId: worn === "unresolved" ? null : worn?.id ?? null,
					replacesName: worn === "unresolved" ? null : worn?.n ?? null,
					statDelta: d,
					obtainable,
					actionability,
					standing: item.sd ?? "unattributed"
				});
			}
		}
		return out;
	}
	//#endregion
	exports.candidates = candidates;
	exports.statDelta = statDelta;
	return exports;
})({});
