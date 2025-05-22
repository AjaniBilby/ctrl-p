(function () {
	const element = {
		cover   : document.createElement("div"),
		pallet  : document.createElement("div"),
		results : document.createElement("div"),
		input   : document.createElement("input"),
	}

	element.cover.className = "ctrl-p dp-disable";
	element.pallet.className = "pallet";
	element.results.style.display = "contents";

	element.pallet.appendChild(element.input);
	element.pallet.appendChild(element.results);
	element.cover.appendChild(element.pallet);





	const pressed = new Set<string>();
	const KEY_MAP = {
		Space:   "space",
		Control: "ctrl",
		Escape:  "esc",
	}

	document.addEventListener("keydown", (ev) => {
		if (element.cover.isConnected) return;

		pressed.add(KEY_MAP[ev.key as keyof typeof KEY_MAP] || ev.key.toLowerCase());
		if (pressed.size === 1) FetchCommands();
		else RefineCommands();

		if (!ev.ctrlKey) return;
		if (!ev.shiftKey) return;
		if (ev.key !== "P") return;

		ev.stopImmediatePropagation();
		ev.stopPropagation();
		ev.preventDefault();
		Open();
	});

	document.addEventListener("keyup", (ev) => {
		pressed.delete(ev.key === " " ? "space" : ev.key.toLowerCase());
		FetchCommands();
	});

	element.input.addEventListener("keydown", (ev) => {
		if (!element.cover.isConnected) return;

		switch (ev.key) {
			case "ArrowUp": {
				ev.preventDefault();
				return UpdateFocus(Math.max(current.focus - 1, 0));
			}
			case "ArrowDown": {
				ev.preventDefault();
				return UpdateFocus(Math.min(current.focus + 1, current.results.length-1));
			}
			case "Enter": {
				ev.preventDefault();
				const focus = current.results[current.focus];
				if (!focus) return;

				focus.command.element.click();
				Close();
				return;
			}
			case "Escape": {
				Close();
				return;
			}
		}
	});

	// after the keypress has taken place
	element.input.addEventListener("keyup", (ev) => {
		if (!element.cover.isConnected) return;
		if (!ev.currentTarget) return;
		if (!(ev.currentTarget instanceof HTMLInputElement)) return;
		if (ev.currentTarget.value === current.search) return;

		Search(ev.currentTarget.value);
	});

	element.cover.addEventListener("click", (ev) => {
		if (ev.target !== element.cover) return;
		Close();
	});





	const commands = new Array<{ txt: string, element: HTMLElement, shortcut: HTMLDivElement }>();
	type SearchResult = {
		command: {
			txt: string;
			element: HTMLElement;
		};
		segments: Segment[];
		shortcut: HTMLDivElement;
	};
	const current = {
		search: "",
		results: new Array<SearchResult>(),
		focus: 0
	}

	function Open() {
		document.body.appendChild(element.cover);
		element.input.focus();
		element.input.value = "";
		pressed.clear();

		commands.length = 0;
		for (const element of document.querySelectorAll(".cmd")) {
			if (!(element instanceof HTMLElement))                 continue;
			if (element.getAttribute("disabled") === "false")      continue;
			if (element.getAttribute("data-disabled") === "false") continue;

			const cmd   = element.getAttribute("data-cmd") || element.getAttribute("cmd");
			const label = element.getAttribute("aria-label");
			const dsc   = element.getAttribute("title") || element.innerText;

			const shortcut = document.createElement('div');
			shortcut.className = "shortcut";

			if (cmd) for (const key of cmd.split(" ")) {
				const e = document.createElement("kbd");
				e.innerText = key;
				shortcut.appendChild(e);
			}


			const txt = (label && dsc) ? `${label}: ${dsc}` : label || dsc || "";
			commands.push({ txt, element, shortcut });
		}

		current.search = "";
		Search("");
	}

	function Close () {
		document.body.removeChild(element.cover);
		element.results.innerHTML = "";
	}


	function Search (search: string) {
		const matching: SearchResult[] = [];

		if (!search) for (const command of commands) matching.push({ command, segments: [{ match: false, str: command.txt }], shortcut: command.shortcut });
		else for (const command of commands) {
			const segments = GetSegments(command.txt, search);
			if (segments.length < 1) continue;

			matching.push({ command, segments, shortcut: command.shortcut });
		}

		matching.sort((a,b) => {
			const diff = a.segments.length - b.segments.length;
			if (diff !== 0) return diff;

			const offset = a.segments[0].str.length - b.segments[0].str.length; //
			if (offset !== 0) return offset;

			return a.command.txt.localeCompare(b.command.txt);
		});

		current.search = search;
		current.results = matching;
		current.focus = 0;

		element.results.innerHTML = "";

		let i = 0;
		for (const match of current.results) {
			const label = document.createElement("div");
			label.className = "label";

			for (const p of match.segments) {
				const b = document.createElement(p.match ? "b" : "span");
				b.innerText = p.str;
				label.appendChild(b);
			}

			const result = document.createElement("div");
			result.className = i++ === 0 ? "result focus" : "result";
			result.appendChild(label);
			result.appendChild(match.shortcut);
			element.results.appendChild(result);
		}
	}

	function UpdateFocus(index: number) {
		current.focus = index;

		let i = 0;
		for (const e of element.results.children) {
			if (!(e instanceof HTMLElement)) continue;
			e.className = i++ === current.focus ? "result focus" : "result";
		}
	}


	function GetSegments(str: string, search: string) {
		const segments: Segment[] = [];

		let cursor = 0;
		let i = 0;
		for (; i<str.length && cursor < search.length;) {
			if (str[i].toLowerCase() === search[cursor].toLowerCase()) {
				SegmentPush(segments, true, str[i]);
				cursor++;
				i++
				continue;
			}

			SegmentPush(segments, false, str[i]);
			i++;
		}

		if (cursor !== search.length) return [];

		if (i+1 < str.length) SegmentPush(segments, false, str.slice(i));
		return segments;
	}

	type Segment = { match: boolean, str: string };
	function SegmentPush(segments: Segment[], match: boolean, str: string) {
		const last = segments[segments.length-1];
		if (last && last.match === match) last.str += str;
		else segments.push({ match, str });
	}





	const shortCuts = new Array<{ keys: Set<string>, element: HTMLElement }>();
	function FetchCommands() {
		if (!document || !document.body) return;
		shortCuts.length = 0;
		for (const e of document.body.querySelectorAll('[data-cmd], [cmd]')) {
			if (!(e instanceof HTMLElement)) continue;

			const cmd = e.getAttribute("data-cmd") || e.getAttribute("cmd");
			if (!cmd) continue;

			const keys = new Set(cmd.toLowerCase().split(" "));

			if (!Subset(pressed, keys)) continue;
			if (keys.size <= pressed.size) return ActivateShortcut(e);

			shortCuts.push({ keys, element: e });
		}
	}
	function RefineCommands() {
		const curr = [...shortCuts];
		for (const opt of curr) {
			if (!Subset(opt.keys, pressed)) continue;

			if (opt.keys.size <= pressed.size) return ActivateShortcut(opt.element);
			shortCuts.push(opt);
		}
	}

	function ActivateShortcut(e: HTMLElement) {
		shortCuts.length = 0;
		pressed.clear();
		return e.click();
	}

	function Subset(sub: Set<string>, sup: Set<string>) {
		for (const e of sub) {
			if (sup.has(e)) continue;
			return false;
		}

		return true;
	}

})()