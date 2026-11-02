"use strict";
const $ = (s, r = document) => r.querySelector(s);
const store = {
  get(k, d) {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      return v === null ? d : v;
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      toast("Could not save. Check that browser storage is allowed.");
    }
  },
};
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmt = (t) =>
  new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const BOARDS = {
  suggestion: {
    name: "Suggestion Box",
    icon: "💡",
    hint: "Send ideas for school improvement. Only you and the school admin can see your entries.",
    subject: "Your idea",
    btn: "Send suggestion",
    priv: true,
  },
  complaint: {
    name: "Complaints",
    icon: "⚠️",
    hint: "Report school related concerns. Only you and the school admin can see your entries.",
    subject: "What is the concern?",
    btn: "Submit complaint",
    priv: true,
  },
  forum: {
    name: "Open Forum",
    icon: "💬",
    hint: "Start respectful discussions and reply to others.",
    subject: "Topic",
    btn: "Start discussion",
    priv: false,
  },
  wall: {
    name: "Freedom Wall",
    icon: "🧱",
    hint: "Share thoughts and messages. Keep it respectful.",
    subject: "Title",
    btn: "Post to wall",
    priv: false,
  },
};
const STATUSES = ["Pending", "Reviewed", "Resolved"];

let session = store.get("sfes_session", null);
let pending = null;
let current = "suggestion";

const users = () => store.get("sfes_users", {});
const posts = () => store.get("sfes_posts", []);
const me = () => users()[session] || null;
const isAdmin = () => !!me() && me().role === "admin";

async function hash(t) {
  if (window.crypto && crypto.subtle) {
    const b = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(t),
    );
    return Array.from(new Uint8Array(b))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  }
  return "x" + btoa(unescape(encodeURIComponent(t)));
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.remove("show"), 2800);
}

const ICONS = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
  register:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6"/>',
  login:
    '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
  board:
    '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 12h6M9 16h6"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
};

const icon = (k) =>
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  ICONS[k] +
  "</svg>";

function show(view) {
  document.querySelectorAll(".view").forEach((v) => {
    v.hidden = v.id !== "view-" + view;
  });

  renderNav(view);

  const cta = $("#homeCta");
  cta.textContent = session ? "Open my boards" : "Get Started";
  cta.dataset.go = session ? "board" : "register";

  window.scrollTo({ top: 0 });
}

function renderNav(view) {
  const nav = $("#nav");
  const menuToggle = $("#menuToggle");

  nav.innerHTML = "";
  nav.classList.remove("menu-open");

  if (menuToggle) {
    menuToggle.classList.remove("active");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
  }

  const items = session
    ? [
        ["home", "Home"],
        ["board", isAdmin() ? "Admin boards" : "Boards"],
      ]
    : [
        ["home", "Home"],
        ["register", "Register"],
        ["login", "Login"],
      ];

  items.forEach(([v, label]) => {
    const b = el("button", "");
    b.type = "button";
    b.dataset.go = v;
    b.innerHTML = icon(v) + " " + label;

    if (v === view || (v === "register" && view === "verify")) {
      b.setAttribute("aria-current", "page");
    }

    nav.appendChild(b);
  });

  if (session) {
    nav.appendChild(el("span", "spacer"));

    const out = el("button", "");
    out.type = "button";
    out.dataset.act = "logout";
    out.innerHTML = icon("logout") + " Logout";

    nav.appendChild(out);
  }
}

// Hamburger menu click listener — added only once.
const menuToggle = $("#menuToggle");
const navMenu = $("#nav");

if (menuToggle && navMenu) {
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.classList.toggle("active");

    navMenu.classList.toggle("menu-open", isOpen);

    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute(
      "aria-label",
      isOpen ? "Close navigation menu" : "Open navigation menu",
    );
  });
}

function go(v) {
  if (v === "board") {
    if (!session) {
      toast("Please login first.");
      return show("login");
    }
    return openBoard(current);
  }

  show(v);
}

document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]");

  if (g) {
    e.preventDefault();

    $("#nav").classList.remove("menu-open");

    if (menuToggle) {
      menuToggle.classList.remove("active");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open navigation menu");
    }

    go(g.dataset.go);

    if (g.dataset.scroll)
      setTimeout(() => {
        const t = document.getElementById(g.dataset.scroll);
        if (t) t.scrollIntoView({ behavior: "smooth" });
      }, 60);

    return;
  }

  const b = e.target.closest("[data-board]");

  if (b) {
    if (!session) {
      toast("Login or register to use this feature.");
      return show("login");
    }

    return openBoard(b.dataset.board);
  }

  if (e.target.closest("[data-act=logout]")) {
    session = null;
    store.set("sfes_session", null);
    toast("Logged out.");
    show("home");
  }
});

function issueCode() {
  pending.code = String(Math.floor(100000 + Math.random() * 900000));

  $("#codeNotice").textContent =
    "Demo mode: your verification code is " +
    pending.code +
    ". A live site would email it to " +
    pending.email +
    ".";
}

$("#regForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = $("#rName").value.trim(),
    id = $("#rId").value.trim(),
    email = $("#rEmail").value.trim(),
    pass = $("#rPass").value,
    err = $("#regErr");

  if (!name || !id || !email || !pass)
    return void (err.textContent = "Please fill in all fields.");

  if (!/^[A-Za-z0-9-]{4,20}$/.test(id))
    return void (err.textContent =
      "Student ID can use letters, numbers and dashes (4 to 20 characters).");

  if (!/^\S+@\S+\.\S+$/.test(email))
    return void (err.textContent = "Enter a valid school email.");

  if (pass.length < 6)
    return void (err.textContent = "Password must be at least 6 characters.");

  if (users()[id])
    return void (err.textContent =
      "This Student ID is already registered. Please login.");

  err.textContent = "";

  pending = { id, name, email, pass: await hash(pass) };

  issueCode();
  $("#vCode").value = "";
  $("#verErr").textContent = "";

  show("verify");
});

$("#resend").addEventListener("click", () => {
  if (!pending) return show("register");

  issueCode();
  toast("New code generated.");
});

$("#verForm").addEventListener("submit", (e) => {
  e.preventDefault();

  if (!pending) return show("register");

  if ($("#vCode").value.trim() !== pending.code)
    return void ($("#verErr").textContent =
      "That code is not correct. Check it and try again.");

  const u = users();

  u[pending.id] = {
    name: pending.name,
    email: pending.email,
    pass: pending.pass,
    role: "student",
  };

  store.set("sfes_users", u);

  session = pending.id;
  store.set("sfes_session", session);

  pending = null;
  $("#regForm").reset();

  toast("Account verified. Welcome!");
  show("home");
});

$("#logForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = $("#lId").value.trim(),
    pw = $("#lPass").value,
    err = $("#logErr");

  if (!id || !pw)
    return void (err.textContent = "Enter your Student ID and password.");

  const u = users()[id];

  if (!u || u.pass !== (await hash(pw)))
    return void (err.textContent = "Student ID or password is incorrect.");

  err.textContent = "";

  session = id;
  store.set("sfes_session", id);

  $("#logForm").reset();

  toast("Welcome back, " + u.name.split(" ")[0] + "!");
  show("home");
});

function openBoard(key) {
  current = key;
  show("board");
  renderBoard();
}

function renderBoard() {
  const b = BOARDS[current],
    admin = isAdmin();

  $("#bTitle").textContent = b.icon + " " + b.name;

  $("#bHint").textContent =
    admin && b.priv
      ? "Review what students sent. Set a status and write a reply."
      : b.hint;

  $("#pSubjectLbl").textContent = b.subject;
  $("#postBtn").textContent = b.btn;
  $("#postErr").textContent = "";
  $("#postForm").hidden = admin && b.priv;

  const tabs = $("#tabs");
  tabs.innerHTML = "";

  Object.keys(BOARDS).forEach((k) => {
    const t = el(
      "button",
      "",
      BOARDS[k].icon + " " + BOARDS[k].name.split(" ")[0],
    );

    t.type = "button";
    t.setAttribute("role", "tab");
    t.setAttribute("aria-selected", String(k === current));
    t.addEventListener("click", () => openBoard(k));

    tabs.appendChild(t);
  });

  renderPosts();
}

function change(id, fn) {
  const all = posts(),
    p = all.find((x) => x.id === id);

  if (!p) return;

  fn(p, all);
  store.set("sfes_posts", all);
  renderPosts();
}

function renderPosts() {
  const b = BOARDS[current],
    list = $("#posts");

  list.innerHTML = "";

  let items = posts().filter((p) => p.board === current);

  if (b.priv && !isAdmin()) {
    items = items.filter((p) => p.uid === session);
  }

  items.sort((a, c) => c.time - a.time);

  const waiting = items.filter(
    (p) => (p.status || "Pending") === "Pending",
  ).length;

  $("#listTitle").textContent = !b.priv
    ? "Latest posts"
    : isAdmin()
      ? "All entries (" + items.length + ", " + waiting + " pending)"
      : "Your entries";

  if (!items.length) {
    list.appendChild(
      el(
        "li",
        "empty",
        b.priv
          ? isAdmin()
            ? "No entries from students yet."
            : "Nothing sent yet. Write your first entry above."
          : "No posts yet. Be the first to start one.",
      ),
    );

    return;
  }

  items.forEach((p) => list.appendChild(buildPost(p, b)));
}

function buildPost(p, b) {
  const li = el("li", "post");
  const head = el("div", "post-head");

  head.appendChild(el("h4", "", p.subject));

  if (b.priv) {
    const st = p.status || "Pending";
    head.appendChild(el("span", "badge " + st, st));
  }

  li.appendChild(head);
  li.appendChild(el("p", "", p.body));

  if (b.priv && p.reply) {
    const r = el("div", "reply");
    const s = el("strong", "", "School reply: ");

    r.append(s, document.createTextNode(p.reply));
    li.appendChild(r);
  }

  if (b.priv && isAdmin()) li.appendChild(adminBox(p));

  if (current === "wall") {
    const likes = p.likes || [],
      liked = likes.indexOf(session) > -1;

    const act = el("div", "actions");
    const lb = el("button", "like", (liked ? "❤️ " : "🤍 ") + likes.length);

    lb.type = "button";
    lb.setAttribute("aria-pressed", String(liked));
    lb.setAttribute("aria-label", "Like this post");

    lb.addEventListener("click", () =>
      change(p.id, (x) => {
        x.likes = x.likes || [];

        const i = x.likes.indexOf(session);

        if (i > -1) x.likes.splice(i, 1);
        else x.likes.push(session);
      }),
    );

    act.appendChild(lb);
    li.appendChild(act);
  }

  if (current === "forum") li.appendChild(commentBlock(p));

  const m = el("div", "meta");

  const who = p.anon
    ? "Anonymous"
    : isAdmin()
      ? p.author + " (" + p.uid + ")"
      : p.author;

  m.appendChild(el("span", "", who + " • " + fmt(p.time)));

  if (p.uid === session || isAdmin()) {
    const d = el("button", "", "Delete");

    d.type = "button";

    d.addEventListener("click", () => {
      if (!confirm("Delete this entry?")) return;

      store.set(
        "sfes_posts",
        posts().filter((x) => x.id !== p.id),
      );

      renderPosts();
      toast("Deleted.");
    });

    m.appendChild(d);
  }

  li.appendChild(m);

  return li;
}

function adminBox(p) {
  const box = el("div", "admin-box");
  const sel = el("select");

  sel.setAttribute("aria-label", "Status");

  STATUSES.forEach((s) => {
    const o = el("option", "", s);

    o.value = s;

    if ((p.status || "Pending") === s) o.selected = true;

    sel.appendChild(o);
  });

  const ta = el("textarea");

  ta.rows = 2;
  ta.maxLength = 400;
  ta.placeholder = "Write a reply to the student";
  ta.value = p.reply || "";

  const save = el("button", "btn", "Save update");

  save.type = "button";

  save.addEventListener("click", () => {
    change(p.id, (x) => {
      x.status = sel.value;
      x.reply = ta.value.trim();
    });

    toast("Update saved.");
  });

  box.append(sel, ta, save);

  return box;
}

function commentBlock(p) {
  const wrap = el("div");
  const ul = el("ul", "comments");

  (p.comments || []).forEach((c) => {
    const li = el("li", "", c.body);

    li.appendChild(el("small", "", c.author + " • " + fmt(c.time)));
    ul.appendChild(li);
  });

  wrap.appendChild(ul);

  const f = el("div", "cform");
  const inp = el("input");

  inp.placeholder = "Write a reply";
  inp.maxLength = 300;
  inp.setAttribute("aria-label", "Write a reply");

  const btn = el("button", "btn", "Reply");
  btn.type = "button";

  const send = () => {
    const v = inp.value.trim();

    if (!v) return;

    change(p.id, (x) => {
      x.comments = x.comments || [];

      x.comments.push({
        uid: session,
        author: me() ? me().name : "Student",
        body: v,
        time: Date.now(),
      });
    });
  };

  btn.addEventListener("click", send);

  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  });

  f.append(inp, btn);
  wrap.appendChild(f);

  return wrap;
}

$("#postForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const subject = $("#pSubject").value.trim(),
    body = $("#pBody").value.trim();

  if (!subject || !body)
    return void ($("#postErr").textContent = "Add a subject and a message.");

  const all = posts();

  all.push({
    id: uid(),
    board: current,
    uid: session,
    author: me() ? me().name : "Student",
    anon: $("#pAnon").checked,
    subject,
    body,
    time: Date.now(),
    status: "Pending",
    reply: "",
    likes: [],
    comments: [],
  });

  store.set("sfes_posts", all);

  $("#postForm").reset();
  $("#postErr").textContent = "";

  renderPosts();
  toast("Posted.");
});

window.addEventListener("storage", () => {
  if (session && !users()[session]) {
    session = null;
    return show("home");
  }

  if (session && !$("#view-board").hidden) renderPosts();
});

(async function init() {
  const u = users();

  if (!u.admin) {
    u.admin = {
      name: "School Admin",
      email: "admin@school.local",
      pass: await hash("admin123"),
      role: "admin",
    };

    store.set("sfes_users", u);
  }

  if (session && !users()[session]) {
    session = null;
    store.set("sfes_session", null);
  }

  show("home");
})();
