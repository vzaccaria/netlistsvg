let _ = require("lodash");

let schedule1 = {
  timer: 0.5,
  runfor: 8,
  class: {
    type: "CFS",
    latency: 6.0,
    mingran: 0.75,
    wgup: 1
  },

  tasks: [
    {
      index: 0,
      name: "$\\tau_1$",
      lambda: 1,
      start: 0,
      events: [8],
      // override vrt
      vrt: 100.0
    },
    {
      index: 1,
      name: "$\\tau_2$",
      lambda: 1.5,
      start: 0,
      events: [8],
      vrt: 100.5
    },
    {
      index: 2,
      name: "$\\tau_3$",
      lambda: 0.5,
      start: 0,
      events: [8],
      vrt: 101.0
    }
  ],
  graphics: {
    vspace: 1,
    hspace: 1,
    barheight: 0.5
  }
};

let schedule0 = {
  timer: 0.5,
  runfor: 8,
  class: {
    type: "CFS",
    latency: 6.0,
    mingran: 0.75,
    wgup: 1
  },

  tasks: [
    {
      index: 0,
      name: "$\\tau_1$",
      lambda: 1,
      start: 0,
      events: [8],
      // override vrt
      vrt: 100.0
    },
    {
      index: 1,
      name: "$\\tau_2$",
      lambda: 1,
      start: 0,
      events: [8],
      vrt: 100.5
    },
    {
      index: 2,
      name: "$\\tau_3$",
      lambda: 1,
      start: 0,
      events: [8],
      vrt: 101.0
    }
  ],
  graphics: {
    vspace: 1,
    hspace: 1,
    barheight: 0.5
  }
};

let schedule2 = {
  timer: 0.5,
  runfor: 12,
  class: {
    type: "CFS",
    latency: 6.0,
    mingran: 0.75,
    wgup: 1
  },

  tasks: [
    {
      index: 0,
      name: "$\\tau_1$",
      lambda: 1,
      start: 0,
      events: [1, 5, 8],
      // override vrt
      vrt: 100.0
    },
    {
      index: 1,
      name: "$\\tau_2$",
      lambda: 1,
      start: 0,
      events: [14],
      vrt: 100.5
    },
    {
      index: 2,
      name: "$\\tau_3$",
      lambda: 1,
      start: 0,
      events: [3, 1, 10],
      vrt: 101.0
    }
  ],
  graphics: {
    vspace: 1,
    hspace: 1,
    barheight: 0.5
  }
};

let schedule3 = {
  timer: 0.5,
  runfor: 24,
  class: {
    type: "CFS",
    latency: 6.0,
    mingran: 0.75,
    wgup: 1
  },

  tasks: [
    {
      index: 0,
      name: "$\\tau_1$",
      lambda: 1,
      start: 0,
      events: [1, 2, 3, 4, 8],
      // override vrt
      vrt: 100.0
    },
    {
      index: 1,
      name: "$\\tau_2$",
      lambda: 1,
      start: 0,
      events: [2, 2, 2, 3, 1],
      vrt: 100.5
    },
    {
      index: 2,
      name: "$\\tau_3$",
      lambda: 1,
      start: 0,
      events: [3, 1, 2, 3, 1],
      vrt: 101.0
    }
  ],
  graphics: {
    vspace: 1,
    hspace: 1,
    barheight: 0.5
  }
};

let schedule4 = {
  timer: 0.5,
  runfor: 16,
  class: { type: "CFS", latency: 6.0, mingran: 0.75, wgup: 1 },
  tasks: [
    { index: 0, name: "R", lambda: 4, start: 0, events: [8], vrt: 0.0 },
    { index: 1, name: "S", lambda: 1, start: 0, events: [8], vrt: 0.0 },
    { index: 2, name: "T", lambda: 1, start: 0, events: [8], vrt: 0.0 }
  ],
  graphics: { vspace: 1, hspace: 1, barheight: 0.5 }
};

let schedule = [
  schedule0,
  schedule1,
  schedule2,
  // _.merge(_.cloneDeep(schedule2), { timer: 0.25 }),
  // _.merge(_.cloneDeep(schedule0), { runfor: 30 }),
  // _.merge(_.cloneDeep(schedule2), { runfor: 40 }),
  // _.merge(_.cloneDeep(schedule2), { timer: 0.25, runfor: 40 }),
  // _.merge(_.cloneDeep(schedule1), { runfor: 40 }),
  schedule3,
  // _.merge(_.cloneDeep(schedule3), {
  //   runfor: 21,
  //   tasks: [{ lambda: 0.5 }, { lambda: 1 }, { lambda: 1.5 }]
  // }),
  schedule4
];

module.exports = { schedule };
