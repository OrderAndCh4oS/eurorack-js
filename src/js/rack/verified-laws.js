// Generated from laws/Rack.bend with Bend 2.0.40. Run npm run laws:generate to update.

// rack.mjs
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
function nat_chk(n) {
  if (n > 281474976710655) {
    throw "bend: a Nat past the largest immediate 2^48-1";
  }
  return n;
}
function nat_in(n) {
  if (!Number.isInteger(n) || n < 0 || n > 2 ** 53) {
    throw "bend: expected a Nat host number: an integer from 0 to 2^53";
  }
  return n;
}
function run_loop(r) {
  while (r !== null && typeof r === "object" && r.$ === "$JMP") {
    r = r.f(r.x);
  }
  return r;
}
function run_lib(f, n) {
  return (...a) => a.length < n ? run_lib((...b) => f(...a, ...b), n - a.length) : run_loop(f(...a));
}
function $position(_requested_0, _last_0) {
  return $Bool_pick($$Nat_is_ge(_last_0, _requested_0), _requested_0, _last_0);
}
function $in_range(_above_min_0, _below_max_0) {
  if (_above_min_0) {
    return _below_max_0;
  } else {
    return false;
  }
}
function $transpose(_chord_0, _semitones_0) {
  if (_chord_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _head_0 = _chord_0["head"];
    const _tail_0 = _chord_0["tail"];
    return { $: "Con", "head": nat_chk(_head_0 + _semitones_0), "tail": $$transpose(_tail_0, _semitones_0) };
  }
}
function $ascending(_chord_0, _two_octaves_0) {
  if (!_two_octaves_0) {
    return _chord_0;
  } else {
    return $List_append(_chord_0, $$transpose(_chord_0, 12));
  }
}
function $Bool_pick(_c_0, _a_0, _b_0) {
  if (!_c_0) {
    return _b_0;
  } else {
    return _a_0;
  }
}
function $Nat_is_ge(_a_0, _b_0) {
  return $Cmp_is_ge(cmp_new(_a_0, _b_0));
}
function $List_append(_xs_0, _ys_0) {
  if (_xs_0.$ === "Nil") {
    return _ys_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", "head": _h_0, "tail": $$List_append(_t_0, _ys_0) };
  }
}
function $Cmp_is_ge(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else {
    return true;
  }
}
var $$Nat_is_ge = $Nat_is_ge;
var $$transpose = $transpose;
var $$List_append = $List_append;
var rack_default = {
  "position": run_lib((a0, a1) => run_loop($position(nat_in(a0), nat_in(a1))), 2),
  "in_range": run_lib((a0, a1) => run_loop($in_range(a0, a1)), 2),
  "transpose": run_lib((a0, a1) => run_loop($transpose(a0, nat_in(a1))), 2),
  "ascending": run_lib((a0, a1) => run_loop($ascending(a0, a1)), 2)
};
export {
  rack_default as default
};
