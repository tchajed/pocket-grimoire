import Template from "../../classes/Template.js";
import TokenStore from "../../classes/TokenStore.js";
import Observer from "../../classes/Observer.js";
import Dialog from "../../classes/Dialog.js";
import BluffDialog from "../../classes/BluffDialog.js";
import TokenDialog from "../../classes/TokenDialog.js";
import {
    lookup,
    lookupOne,
    lookupOneCached,
    replaceContentsMany,
    empty
} from "../../utils/elements.js";

// The top-down controller for all groups of demon bluffs.
class BluffsGroups {

    static get VISIBLE() {
        return "bluff-group-visible";
    }

    static setDialog(dialog) {
        this.dialog = dialog;
    }

    constructor(container) {

        this.groups = [];
        this.container = container;
        this.visibleGroupIndex = -1;

        this.observer = new IntersectionObserver((entries) => {

            entries.forEach(({ target, intersectionRatio }) => {

                if (intersectionRatio === 1) {

                    target.dispatchEvent(
                        new CustomEvent(this.constructor.VISIBLE, {
                            bubbles: true,
                            cancelable: false
                        })
                    );

                }

            });

        }, {
            root: container,
            threshold: 1
        });

    }

    add(group) {

        if (this.has(group)) {
            return;
        }

        group.setIndex(this.groups.push(group) - 1);
        this.container.append(group.draw());
        group.setElement(this.container.querySelector(group.getSelector()));
        this.observer.observe(group.getElement());
        group.ready();

    }

    has(group) {
        return this.groups.includes(group);
    }

    getIndex(group) {
        return this.groups.indexOf(group);
    }

    remove(group) {
        this.removeByIndex(this.getIndex(group));
    }

    removeByIndex(index) {

        const {
            groups
        } = this;

        index = Number(index);

        if (index < 0 || index >= groups.length) {
            return;
        }

        const group = groups[index];

        this.observer.unobserve(group.getElement());
        group.remove();
        groups.splice(index, 1);
        this.updateIndicies();

    }

    updateIndicies() {
        this.groups.forEach((group, index) => group.setIndex(index));
    }

    getVisibleGroupIndex() {
        return this.visibleGroupIndex;
    }

    setVisibleGroupIndex(index) {

        index = Number(index);

        if (index < 0 || index > this.groups.length) {
            throw new RangeError(`Visible index ${index} is out of range`);
        }

        this.visibleGroupIndex = index;

    }

    getVisibleGroup() {

        const group = this.groups[this.visibleGroupIndex];

        if (!group) {
            throw new Error(`Cannot find group at index ${this.visibleGroupIndex}`);
        }

        return group;

    }

    setInnerIndex(index) {

        const group = this.getVisibleGroup();

        group.setSetIndex(index);
        this.constructor.dialog?.display(group.getCharacter());

    }

    getInnerIndex() {
        return this.getVisibleGroup().getSetIndex();
    }

    setCharacter(character) {

        this.getVisibleGroup().setCharacter(character);
        this.constructor.dialog?.display(character);

    }

    redraw() {
        this.getVisibleGroup().redrawButton();
    }

    serialise() {
        return this.groups.map((group) => group.serialise());
    }

}

// Manages the DOM elements that manage the group of 3 demon bluffs.
class BluffsGroup {

    static get READY() {
        return "bluff-group-ready";
    }

    static setTemplate(template) {
        this.template = template;
    }

    // static setSettableTitle(TitleClass) {
    //     this.SettableTitle = TitleClass;
    // }

    constructor(bluffSet) {

        this.index = 0;
        this.bluffSet = bluffSet;

    }

    setElement(element) {
        this.element = element;
    }

    getElement() {
        return this.element;
    }

    setIndex(index) {

        this.index = index;

        if (this.element) {
            this.element.dataset.groupId = this.index;
        }

    }

    serialise() {

        const {
            bluffSet,
            settableTitle
        } = this;

        return {
            name: settableTitle?.getTitle() || "",
            set: bluffSet.serialise()
        };

    }

    draw() {

        return this.constructor.template.draw({
            ".js--demon-bluffs--group": (element) => {
                element.dataset.groupId = this.index;
            }
        })

    }

    getSelector() {
        return `.js--demon-bluffs--group[data-group-id="${this.index}"]`;
    }

    getSetIndex() {
        return this.bluffSet.getIndex();
    }

    setSetIndex(index) {
        return this.bluffSet.setIndex(index);
    }

    setCharacter(character) {
        this.bluffSet.setCharacter(character);
    }

    getCharacter(index) {
        return this.bluffSet.getCharacter(index);
    }

    ready() {

        const {
            element,
            bluffSet,
            constructor: {
                READY
            }
        } = this;

        if (!element) {
            return;
        }

        element.scrollIntoView({
            block: "nearest"
        });

        bluffSet.getCharacters().forEach((character, index) => {

            const button = lookupOne(
                `.js--demon-bluffs--bluff[data-index="${index}"]`,
                element
            );

            empty(button).append(character.drawToken());

        });

        element.dispatchEvent(new CustomEvent(READY, {
            bubbles: true,
            cancelable: false,
            detail: {
                bluffGroup: this
            }
        }));

    }

    remove() {
        this.element?.remove();
    }

    redrawButton() {

        const {
            element,
            bluffSet
        } = this;

        const setIndex = bluffSet.getIndex();
        const character = bluffSet.getCharacter(setIndex);

        empty(lookupOne(
            `.js--demon-bluffs--bluff[data-index="${setIndex}"]`,
            element
        )).append(character.drawToken());

    }

    setSettableTitle(settableTitle) {
        this.settableTitle = settableTitle;
    }

}

// Manages the set of 3 demon bluffs, handling the tokens.
class BluffSet {

    static setEmptyCharacter(emptyCharacter) {
        this.emptyCharacter = emptyCharacter;
    }

    constructor() {

        const {
            emptyCharacter
        } = this.constructor;

        if (!emptyCharacter) {
            throw new Error("The \"No character\" character needs to be set.");
        }

        this.characters = [
            emptyCharacter.clone(),
            emptyCharacter.clone(),
            emptyCharacter.clone()
        ];

        this.index = 0;

    }

    validateIndex(index) {

        index = Number(index);

        if (index < 0 || index >= this.characters.length) {

            if (showThrow) {
                throw new RangeError(`BluffSet invalid index ${index}`)
            }

            return -1;

        }

        return index;

    }

    getCharacters() {
        return [...this.characters];
    }

    getCharacter(index = this.index) {
        return this.characters[this.validateIndex(index)];
    }

    setCharacter(character, index = this.index) {
        this.characters[this.validateIndex(index)] = character;
    }

    unsetCharacter(character) {
        this.unsetCharacterByIndex(this.characters.indexOf(character));
    }

    unsetCharacterByIndex(index) {

        this.characters[this.validateIndex(index)] = (
            this.constructor.emptyCharacter.clone()
        );

    }

    setIndex(index) {
        this.index = this.validateIndex(index);
    }

    getIndex() {
        return this.index;
    }

    serialise() {
        return this.characters.map((character) => character.getId());
    }

}

class SettableTitle {

    constructor(title, input) {

        this.title = title;
        this.input = input;
        this.list = input.list;

        if (!this.title || !this.input || !this.list) {
            throw new Error("Settable title not properly configured");
        }

        this.start = this.list.querySelector(".js--settable-title--start");
        this.previous = this.list.querySelector(".js--settable-title--previous");

        this.start.value = title.textContent;

        this.addListeners();

    }

    addListeners() {

        const {
            title,
            input
        } = this;

        title.addEventListener("click", () => {

            this.showInput();
            input.focus();

        });

        input.addEventListener("focus", () => {
            input.value = "";
        });

        input.addEventListener("blur", () => {

            this.hideInput();
            this.updatePrevious();

        });

        input.addEventListener("input", () => {

            this.setTitle(input.value);
            this.updateInputWidth();

        });

        input.form?.addEventListener("submit", (e) => {

            e.preventDefault();
            e.stopPropagation();
            input.blur();

        });

        // TODO: update list etc.

    }

    isShowingInput() {
        return !this.input.hidden;
    }

    toggleInput(forceState) {

        if (forceState === undefined) {
            forceState = !this.isShowingInput();
        }

        if (forceState === this.isShowingInput()) {
            return;
        }

        const {
            title,
            input
        } = this;

        // title.hidden = forceState;
        this.updateInputWidth();
        title.setAttribute("aria-hidden", forceState);
        input.hidden = !forceState;

    }

    showInput() {
        this.toggleInput(true);
    }

    hideInput() {
        this.toggleInput(false);
    }

    updateInputWidth() {

        this.input.style.setProperty(
            "--width",
            this.title.getBoundingClientRect().width
        );

    }

    updatePrevious() {

        const {
            input,
            previous
        } = this;

        if (previous && input.value) {
            previous.value = input.value;
        }

    }

    setTitle(title) {
        this.title.textContent = title;
    }

    getTitle() {
        return this.title.textContent;
    }

    getStartText() {
        return this.start?.value || "";
    }

}

const gameObserver = Observer.create("game");
const tokenObserver = Observer.create("token");
const tokenDialog = TokenDialog.get();
const bluffDialog = BluffDialog.create(lookupOne("#bluff-show"));

BluffsGroups.setDialog(bluffDialog);
BluffsGroup.setTemplate(Template.create(lookupOne("#demon-bluffs-template")));

TokenStore.ready((tokenStore) => {

    BluffSet.setEmptyCharacter(tokenStore.getEmptyCharacter());

    const bluffGroupsContainer = lookupOne("#demon-bluffs-group");
    const bluffGroups = new BluffsGroups(bluffGroupsContainer);

    bluffGroupsContainer.addEventListener("click", ({ target }) => {

        const button = target.closest(".js--demon-bluffs--remove");
        const group = button?.closest(".js--demon-bluffs--group");

        if (!button || !group) {
            return;
        }

        bluffGroups.removeByIndex(group.dataset.groupId);

    });

    bluffGroupsContainer.addEventListener("click", ({ target }) => {

        const button = target.closest(".js--demon-bluffs--bluff[data-index]");

        if (!button) {
            return;
        }

        bluffGroups.setInnerIndex(button.dataset.index);

    });

    bluffGroupsContainer.addEventListener(BluffsGroups.VISIBLE, ({ target }) => {
        bluffGroups.setVisibleGroupIndex(target.dataset.groupId);
    });

    bluffGroupsContainer.addEventListener(BluffsGroup.READY, ({ detail }) => {

        const {
            bluffGroup
        } = detail;
        const element = bluffGroup.getElement();

        lookup("[data-bluff-dialog]", element).forEach((trigger) => {
            trigger.dialog = BluffDialog.createFromTrigger(trigger);
        });

        bluffGroup.setSettableTitle(new SettableTitle(
            element.querySelector(".js--settable-title--title"),
            element.querySelector(".js--settable-title--input")
        ));

    });

    bluffGroups.add(new BluffsGroup(new BluffSet()));

    lookupOne("#add-bluffs").addEventListener("click", () => {
        bluffGroups.add(new BluffsGroup(new BluffSet()));
    });

    gameObserver.on("characters-selected", ({ detail }) => {

        const characterTemplate = Template.create(
            lookupOneCached("#character-list-template")
        );
        const characters = [
            tokenStore.characters[TokenStore.EMPTY],
            ...detail.characters
        ];

        replaceContentsMany(
            lookupOneCached("#character-list__bluffs"),
            characters.map((character) => characterTemplate.draw({
                ".js--character-list--item"(element) {

                    element.dataset.characterId = character.getId();
                    element.dataset.team = character.getTeam();

                },
                ".js--character-list--button"(element) {
                    element.dataset.tokenId = character.getId();
                },
                ".js--character-list--token"(element) {
                    element.append(character.drawToken());
                }
            }))
        );

    });

    // Show all possible bluffs dialog.

    function toggleBluffListClass(className, state) {

        lookupOneCached("#character-list__bluffs")
            .classList
            .toggle(className, state);

    }

    lookupOne("#show-existing").addEventListener("change", ({ target }) => {
        toggleBluffListClass("is-show-existing", target.checked);
    });

    lookupOne("#show-travellers").addEventListener("change", ({ target }) => {
        toggleBluffListClass("is-show-travellers", target.checked);
    });

    lookupOne("#show-evil").addEventListener("change", ({ target }) => {
        toggleBluffListClass("is-show-evil", target.checked);
    });

    const rolesInPlay = Object.create(null);

    tokenObserver.on("character-add", ({ detail }) => {

        const id = detail.character.getId();

        if (!rolesInPlay[id]) {
            rolesInPlay[id] = 0;
        }

        rolesInPlay[id] += 1;

    });

    tokenObserver.on("character-remove", ({ detail }) => {

        const id = detail.character.getId();

        if (rolesInPlay[id]) {
            rolesInPlay[id] -= 1;
        }

        if (!rolesInPlay[id] || rolesInPlay[id] < 0) {
            delete rolesInPlay[id];
        }

    });

    const bluffListDialog = Dialog.create(lookupOne("#bluff-list"));

    bluffListDialog.on(Dialog.SHOW, () => {

        Object
            .keys(rolesInPlay)
            .concat(bluffGroups.getVisibleGroup().serialise().set)
            .filter(Boolean) // remove any empty IDs
            .forEach((id) => {

                const token = lookupOne(
                    `#character-list__bluffs [data-character-id="${id}"]`
                );
                token?.classList.add("is-in-play");

            });

    });

    bluffListDialog.on(Dialog.HIDE, () => {

        lookup("#character-list__bluffs .is-in-play").forEach((token) => {
            token.classList.remove("is-in-play");
        });

    });

    lookupOne("#character-list__bluffs").addEventListener("click", ({ target }) => {

        const button = target.closest("[data-token-id]")

        if (!button) {
            return;
        }

        // assign the chosen character to the correct set
        const character = tokenStore.getCharacter(button.dataset.tokenId);
        bluffGroups.setCharacter(character);
        bluffGroups.redraw();
        // close the dialog
        bluffListDialog.hide();
        bluffDialog.hide();

    });

    // Bluff token dialog.

    lookupOneCached(
        "#bluff-show-token",
        bluffDialog.getElement()
    ).addEventListener("click", ({ target }) => {

        const id = target.closest("[data-character-id]")?.dataset.characterId;

        if (!id) {
            return;
        }

        tokenDialog.setIds([id]);
        tokenDialog.show();
        bluffDialog.hide();

    });

    lookupOneCached("#show-all-bluffs").addEventListener("click", ({ target }) => {

        tokenDialog.setIds(bluffGroups.getVisibleGroup().serialise().set);
        tokenDialog.setMultipleTitle(target.dataset.title);
        tokenDialog.show();

    });

    /* TEMP */console.log("window.bluffGroups = %o", bluffGroups);window.bluffGroups = bluffGroups;/* TEMP */

});

// NEXT STEPS
//
// Clearing the grimoire won't clear the bluffs.
// The store can't re-load the bluffs yet.
// The TokenDialog class isn't using the SettableTitle class.
// There's no event triggering when a demon bluff is selected. (update events.md)
// There's no communal list of demon bluff names (needed?)
// The old Bluff* classes haven't been deleted.


/*
import Bluff from "../../classes/Bluff.js";
import Bluffs from "../../classes/Bluffs.js";
import BluffDialog from "../../classes/BluffDialog.js";
import BluffList from "../../classes/BluffList.js";
import Dialog from "../../classes/Dialog.js";
import TokenStore from "../../classes/TokenStore.js";
import Template from "../../classes/Template.js";
import Observer from "../../classes/Observer.js";
// import CharacterToken from "../../classes/CharacterToken.js";
import TokenDialog from "../../classes/TokenDialog.js";
import {
    lookup,
    lookupCached,
    lookupOne,
    lookupOneCached,
    replaceContentsMany
} from "../../utils/elements.js";

const gameObserver = Observer.create("game");
const tokenObserver = Observer.create("token");
const tokenDialog = TokenDialog.get();

const bluffs = Bluffs.create(
    lookupCached(".js--character-list--bluff").map((button) => new Bluff(button)),
    tokenObserver
);

TokenStore.ready((tokenStore) => {

    const noCharacter = tokenStore.getEmptyCharacter();

    bluffs.setNoCharacter(noCharacter);
    bluffs.reset(false);

});

lookupCached("[data-bluff-dialog]").forEach((trigger) => {
    trigger.dialog = BluffDialog.createFromTrigger(trigger);
});

const bluffDialog = BluffDialog.create(lookupOne("#bluff-show"));

TokenStore.ready((tokenStore) => {

    gameObserver.on("characters-selected", ({ detail }) => {

        const characterTemplate = Template.create(
            lookupOneCached("#character-list-template")
        );
        const characters = [
            tokenStore.characters[TokenStore.EMPTY],
            ...detail.characters
        ];

        replaceContentsMany(
            lookupOneCached("#character-list__bluffs"),
            characters.map((character) => characterTemplate.draw({
                ".js--character-list--item"(element) {

                    element.dataset.characterId = character.getId();
                    element.dataset.team = character.getTeam();

                },
                ".js--character-list--button"(element) {
                    element.dataset.tokenId = character.getId();
                },
                ".js--character-list--token"(element) {
                    element.append(character.drawToken());
                }
            }))
        );

        lookupCached(".js--character-list--bluff").forEach((button) => {
            button.disabled = false;
        });

    });

    function markInPlay(character, shouldAdd = true) {

        const inPlay = lookupOne(
            `#character-list__bluffs [data-character-id="${character.getId()}"]`
        );

        if (inPlay) {
            inPlay.classList.toggle("is-in-play", shouldAdd);
        }

    }

    gameObserver.on("character-drawn", ({ detail }) => {
        markInPlay(detail.character);
    });

    tokenObserver.on("character-add", ({ detail }) => {
        markInPlay(detail.character);
    });

    tokenObserver.on("character-remove", ({ detail }) => {
        markInPlay(detail.character, false);
    });

    tokenObserver.on("bluff", ({ detail }) => {

        const character = tokenStore.getCharacter(detail.character);

        if (character.getId()) {
            markInPlay(character);
        }

        const previous = tokenStore.getCharacter(detail.previous);

        if (previous && previous.getId() && !previous.isEmpty()) {
            markInPlay(previous, false);
        }

    });

    gameObserver.on("clear", () => {

        bluffs.reset();

        lookup("#character-list__bluffs .is-in-play").forEach((token) => {
            token.classList.remove("is-in-play");
        });

    });

    lookupOneCached(
        "#bluff-show-token",
        bluffDialog.getElement()
    ).addEventListener("click", ({ target }) => {

        const id = target.closest("[data-character-id]")?.dataset.characterId;

        if (!id) {
            return;
        }

        tokenDialog.setIds([id]);
        tokenDialog.show();
        bluffDialog.hide();

    });

    lookupOneCached("#show-all-bluffs").addEventListener("click", ({ target }) => {
        tokenDialog.setIds(bluffs.getIds());
        tokenDialog.setMultipleTitle(target.dataset.title);
        tokenDialog.show();
    });

});

function toggleBluffListClass(className, state) {

    lookupOneCached("#character-list__bluffs")
        .classList
        .toggle(className, state);

}

lookupOne("#show-existing").addEventListener("change", ({ target }) => {
    toggleBluffListClass("is-show-existing", target.checked);
});

lookupOne("#show-travellers").addEventListener("change", ({ target }) => {
    toggleBluffListClass("is-show-travellers", target.checked);
});

lookupOne("#show-evil").addEventListener("change", ({ target }) => {
    toggleBluffListClass("is-show-evil", target.checked);
});

const bluffList = new BluffList(
    BluffDialog.create(lookupOneCached("#bluff-show"))
);

lookupCached(".js--character-list--bluff").forEach((button) => {

    button.addEventListener("click", ({ target }) => {

        const button = target.closest("button");

        if (!button) {
            return;
        }

        bluffList.open(bluffs.getBluffByButton(button));

    });

});

const bluffListDialog = Dialog.create(lookupOne("#bluff-list"));

lookupOneCached("#character-list__bluffs").addEventListener("click", ({ target }) => {

    TokenStore.ready((tokenStore) => {

        const character = tokenStore.getCharacter(
            target.closest("[data-character-id]").dataset.characterId
        );

        if (!character) {
            return;
        }

        bluffDialog.hide();
        bluffDialog.display(character);
        bluffList.select(character);
        bluffListDialog.hide();

    });

});
*/
