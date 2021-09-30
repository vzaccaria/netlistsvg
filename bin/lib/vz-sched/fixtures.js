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
      events: [1, 5, 2],
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
      events: [3, 1],
      vrt: 101.0
    }
  ],
  graphics: {
    vspace: 1,
    hspace: 1,
    barheight: 0.5
  }
};

module.exports = { schedule0, schedule1, schedule2 };
