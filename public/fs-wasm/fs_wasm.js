/* @ts-self-types="./fs_wasm.d.ts" */

/**
 * JS result of a fallible brownian export. `envelope` is always present.
 * `values` is empty only when `envelope` is a refusal; a successful call
 * always has length `n_particles * (steps + 1) >= 2`.
 */
export class BrownianJs {
    static __wrap(ptr) {
        const obj = Object.create(BrownianJs.prototype);
        obj.__wbg_ptr = ptr;
        BrownianJsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BrownianJsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_brownianjs_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get envelope() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.brownianjs_envelope(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {Float64Array}
     */
    get values() {
        const ret = wasm.brownianjs_values(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
}
if (Symbol.dispose) BrownianJs.prototype[Symbol.dispose] = BrownianJs.prototype.free;

/**
 * JS result of `diffusion1d_frames`. Empty `values` only when `envelope`
 * names a refusal; the empty buffer is not itself the refusal.
 */
export class Diffusion1dJs {
    static __wrap(ptr) {
        const obj = Object.create(Diffusion1dJs.prototype);
        obj.__wbg_ptr = ptr;
        Diffusion1dJsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        Diffusion1dJsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_diffusion1djs_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get envelope() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.diffusion1djs_envelope(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {Float64Array}
     */
    get values() {
        const ret = wasm.diffusion1djs_values(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
}
if (Symbol.dispose) Diffusion1dJs.prototype[Symbol.dispose] = Diffusion1dJs.prototype.free;

/**
 * JS result of `philox_normals`. Empty `values` only when `envelope` names
 * a refusal or budget miss; the empty buffer is not itself the refusal.
 */
export class PhiloxNormalsJs {
    static __wrap(ptr) {
        const obj = Object.create(PhiloxNormalsJs.prototype);
        obj.__wbg_ptr = ptr;
        PhiloxNormalsJsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PhiloxNormalsJsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_philoxnormalsjs_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get envelope() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.philoxnormalsjs_envelope(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {Float64Array}
     */
    get values() {
        const ret = wasm.philoxnormalsjs_values(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
}
if (Symbol.dispose) PhiloxNormalsJs.prototype[Symbol.dispose] = PhiloxNormalsJs.prototype.free;

/**
 * Admit-or-refuse JSON without packing the sample buffer as JSON numbers.
 * @param {number} n_particles
 * @param {number} steps
 * @param {number} step_kernel
 * @param {bigint} seed
 * @param {number} diffusion
 * @param {number} dt
 * @returns {string}
 */
export function admit_brownian_frames(n_particles, steps, step_kernel, seed, diffusion, dt) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.admit_brownian_frames(n_particles, steps, step_kernel, seed, diffusion, dt);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} n
 * @param {number} frames
 * @param {number} steps_per_frame
 * @param {number} diffusion
 * @param {number} dx
 * @param {number} dt
 * @param {number} profile
 * @returns {string}
 */
export function admit_diffusion1d_frames(n, frames, steps_per_frame, diffusion, dx, dt, profile) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.admit_diffusion1d_frames(n, frames, steps_per_frame, diffusion, dx, dt, profile);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {bigint} seed
 * @param {number} stream_kernel
 * @param {number} tile
 * @param {bigint} start_index
 * @param {number} count
 * @returns {string}
 */
export function admit_philox_normals(seed, stream_kernel, tile, start_index, count) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.admit_philox_normals(seed, stream_kernel, tile, start_index, count);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} max_iters
 * @param {number} delta
 * @param {number} alpha
 * @returns {Float64Array}
 */
export function anytimebo(max_iters, delta, alpha) {
    const ret = wasm.anytimebo(max_iters, delta, alpha);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} xmin
 * @param {number} xmax
 * @param {number} samples
 * @returns {Float64Array}
 */
export function autodiff_derivatives(xmin, xmax, samples) {
    const ret = wasm.autodiff_derivatives(xmin, xmax, samples);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} shape
 * @returns {Float64Array}
 */
export function betti_shapes(shape) {
    const ret = wasm.betti_shapes(shape);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * One-shot frames. Refusals travel in `envelope`; `values` is then empty
 * because the envelope names the refusal, not because the buffer is the
 * refusal.
 * @param {number} n_particles
 * @param {number} steps
 * @param {number} step_kernel
 * @param {bigint} seed
 * @param {number} diffusion
 * @param {number} dt
 * @returns {BrownianJs}
 */
export function brownian_frames(n_particles, steps, step_kernel, seed, diffusion, dt) {
    const ret = wasm.brownian_frames(n_particles, steps, step_kernel, seed, diffusion, dt);
    return BrownianJs.__wrap(ret);
}

/**
 * @param {number} kind
 * @param {number} samples
 * @returns {Float64Array}
 */
export function chebyshev_fit(kind, samples) {
    const ret = wasm.chebyshev_fit(kind, samples);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} kind
 * @returns {Float64Array}
 */
export function chebyshev_spectrum(kind) {
    const ret = wasm.chebyshev_spectrum(kind);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} seed
 * @param {number} gens
 * @returns {Float64Array}
 */
export function cmaes_trace(seed, gens) {
    const ret = wasm.cmaes_trace(seed, gens);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} count
 * @param {number} log10_big
 * @returns {Float64Array}
 */
export function compensated_sum(count, log10_big) {
    const ret = wasm.compensated_sum(count, log10_big);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} base
 * @param {number} target
 * @param {number} radius
 * @returns {Float64Array}
 */
export function cutfem_quadtree(base, target, radius) {
    const ret = wasm.cutfem_quadtree(base, target, radius);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} n
 * @param {number} stiffness
 * @returns {Float64Array}
 */
export function cyclic_symmetry(n, stiffness) {
    const ret = wasm.cyclic_symmetry(n, stiffness);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Material-indexed absorbed and transmitted collimated-beam power.
 * @param {Float64Array} mass_field
 * @param {Uint32Array} cell_materials
 * @param {number} nx
 * @param {number} ny
 * @param {Float64Array} wavelengths_nm
 * @param {Float64Array} mass_absorption_m2_kg
 * @param {number} density_unit_kg_m3
 * @param {number} lattice_spacing_m
 * @param {number} slab_depth_m
 * @param {Float64Array} irradiance_w_m2_nm
 * @param {boolean} irradiance_per_column
 * @param {Float64Array} quadrature_weights_nm
 * @param {boolean} positive_z
 * @returns {Float64Array}
 */
export function deposit_vessel_indexed_spectral_beam(mass_field, cell_materials, nx, ny, wavelengths_nm, mass_absorption_m2_kg, density_unit_kg_m3, lattice_spacing_m, slab_depth_m, irradiance_w_m2_nm, irradiance_per_column, quadrature_weights_nm, positive_z) {
    const ptr0 = passArrayF64ToWasm0(mass_field, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(cell_materials, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(wavelengths_nm, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF64ToWasm0(mass_absorption_m2_kg, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF64ToWasm0(irradiance_w_m2_nm, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayF64ToWasm0(quadrature_weights_nm, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ret = wasm.deposit_vessel_indexed_spectral_beam(ptr0, len0, ptr1, len1, nx, ny, ptr2, len2, ptr3, len3, density_unit_kg_m3, lattice_spacing_m, slab_depth_m, ptr4, len4, irradiance_per_column, ptr5, len5, positive_z);
    var v7 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v7;
}

/**
 * Original-cell absorbed and transmitted beam power, with explicit irradiance units.
 * @param {Float64Array} mass_field
 * @param {number} nx
 * @param {number} ny
 * @param {Float64Array} wavelengths_nm
 * @param {Float64Array} mass_absorption_m2_kg
 * @param {number} density_unit_kg_m3
 * @param {number} lattice_spacing_m
 * @param {number} slab_depth_m
 * @param {Float64Array} irradiance_w_m2_nm
 * @param {boolean} irradiance_per_column
 * @param {Float64Array} quadrature_weights_nm
 * @param {boolean} positive_z
 * @returns {Float64Array}
 */
export function deposit_vessel_spectral_beam(mass_field, nx, ny, wavelengths_nm, mass_absorption_m2_kg, density_unit_kg_m3, lattice_spacing_m, slab_depth_m, irradiance_w_m2_nm, irradiance_per_column, quadrature_weights_nm, positive_z) {
    const ptr0 = passArrayF64ToWasm0(mass_field, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(wavelengths_nm, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(mass_absorption_m2_kg, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF64ToWasm0(irradiance_w_m2_nm, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF64ToWasm0(quadrature_weights_nm, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ret = wasm.deposit_vessel_spectral_beam(ptr0, len0, nx, ny, ptr1, len1, ptr2, len2, density_unit_kg_m3, lattice_spacing_m, slab_depth_m, ptr3, len3, irradiance_per_column, ptr4, len4, positive_z);
    var v6 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v6;
}

/**
 * @param {number} n
 * @param {number} frames
 * @param {number} steps_per_frame
 * @param {number} diffusion
 * @param {number} dx
 * @param {number} dt
 * @param {number} profile
 * @returns {Diffusion1dJs}
 */
export function diffusion1d_frames(n, frames, steps_per_frame, diffusion, dx, dt, profile) {
    const ret = wasm.diffusion1d_frames(n, frames, steps_per_frame, diffusion, dx, dt, profile);
    return Diffusion1dJs.__wrap(ret);
}

/**
 * A build stamp so the page can prove it's running the real engine.
 * @returns {string}
 */
export function engine() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.engine();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} grid
 * @param {number} controls
 * @param {number} amp
 * @param {number} mode
 * @returns {Float64Array}
 */
export function ffd_deform(grid, controls, amp, mode) {
    const ret = wasm.ffd_deform(grid, controls, amp, mode);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} n
 * @param {number} seed
 * @returns {Float64Array}
 */
export function fft_power_spectrum(n, seed) {
    const ret = wasm.fft_power_spectrum(n, seed);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} x0
 * @param {number} steps
 * @returns {Float64Array}
 */
export function finite_difference_error(x0, steps) {
    const ret = wasm.finite_difference_error(x0, steps);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} steps
 * @param {number} tol
 * @returns {Float64Array}
 */
export function flowcert(steps, tol) {
    const ret = wasm.flowcert(steps, tol);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} n
 * @param {number} frames
 * @returns {Float64Array}
 */
export function fluid_frames(n, frames) {
    const ret = wasm.fluid_frames(n, frames);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} lo
 * @param {number} hi
 * @param {number} steps
 * @returns {Float64Array}
 */
export function fluttercert(lo, hi, steps) {
    const ret = wasm.fluttercert(lo, hi, steps);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} n_points
 * @param {number} steps
 * @returns {Float64Array}
 */
export function ga_motor_orbit(n_points, steps) {
    const ret = wasm.ga_motor_orbit(n_points, steps);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} n_train
 * @param {number} samples
 * @returns {Float64Array}
 */
export function gp_regression(n_train, samples) {
    const ret = wasm.gp_regression(n_train, samples);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} match_tol
 * @param {number} simplify_radius_threshold
 * @returns {Float64Array}
 */
export function grammarforge(match_tol, simplify_radius_threshold) {
    const ret = wasm.grammarforge(match_tol, simplify_radius_threshold);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} n
 * @param {number} frames
 * @param {number} feed
 * @param {number} kill
 * @returns {Float64Array}
 */
export function gray_scott_frames(n, frames, feed, kill) {
    const ret = wasm.gray_scott_frames(n, frames, feed, kill);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} n
 * @param {number} frames
 * @param {number} steps_per_frame
 * @returns {Float64Array}
 */
export function heat_frames(n, frames, steps_per_frame) {
    const ret = wasm.heat_frames(n, frames, steps_per_frame);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} shape
 * @returns {Float64Array}
 */
export function hodge_decomposition(shape) {
    const ret = wasm.hodge_decomposition(shape);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} n
 * @param {number} maxit
 * @returns {Float64Array}
 */
export function krylov_convergence(n, maxit) {
    const ret = wasm.krylov_convergence(n, maxit);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} n
 * @param {number} k
 * @returns {Float64Array}
 */
export function laplacian_modes(n, k) {
    const ret = wasm.laplacian_modes(n, k);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} steps
 * @param {number} dt
 * @param {number} rho
 * @returns {Float64Array}
 */
export function lorenz_points(steps, dt, rho) {
    const ret = wasm.lorenz_points(steps, dt, rho);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} w
 * @param {number} h
 * @param {number} cx
 * @param {number} cy
 * @param {number} scale
 * @param {number} maxiter
 * @returns {Float64Array}
 */
export function mandelbrot_certified(w, h, cx, cy, scale, maxiter) {
    const ret = wasm.mandelbrot_certified(w, h, cx, cy, scale, maxiter);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} res
 * @param {number} kind
 * @param {number} iso
 * @returns {Float64Array}
 */
export function marching_cubes(res, kind, iso) {
    const ret = wasm.marching_cubes(res, kind, iso);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} n
 * @param {number} points
 * @param {number} rmax
 * @returns {Float64Array}
 */
export function metamatcert(n, points, rmax) {
    const ret = wasm.metamatcert(n, points, rmax);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} cells
 * @param {number} frames
 * @param {number} re
 * @param {number} steps_per_frame
 * @returns {Float64Array}
 */
export function navier_stokes_cavity(cells, frames, re, steps_per_frame) {
    const ret = wasm.navier_stokes_cavity(cells, frames, re, steps_per_frame);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} lift
 * @param {number} ring_r
 * @param {number} inner
 * @returns {Float64Array}
 */
export function neuroshape(lift, ring_r, inner) {
    const ret = wasm.neuroshape(lift, ring_r, inner);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} n
 * @param {number} epsilon
 * @returns {Float64Array}
 */
export function optimal_transport(n, epsilon) {
    const ret = wasm.optimal_transport(n, epsilon);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} alpha
 * @param {number} n
 * @param {number} re_min
 * @param {number} re_max
 * @param {number} steps
 * @returns {Float64Array}
 */
export function orr_sommerfeld_curve(alpha, n, re_min, re_max, steps) {
    const ret = wasm.orr_sommerfeld_curve(alpha, n, re_min, re_max, steps);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} re
 * @param {number} alpha
 * @param {number} n
 * @returns {number}
 */
export function orr_sommerfeld_max_growth(re, alpha, n) {
    const ret = wasm.orr_sommerfeld_max_growth(re, alpha, n);
    return ret;
}

/**
 * @param {bigint} seed
 * @param {number} stream_kernel
 * @param {number} tile
 * @param {bigint} start_index
 * @param {number} count
 * @returns {PhiloxNormalsJs}
 */
export function philox_normals(seed, stream_kernel, tile, start_index, count) {
    const ret = wasm.philox_normals(seed, stream_kernel, tile, start_index, count);
    return PhiloxNormalsJs.__wrap(ret);
}

/**
 * @param {number} n
 * @returns {Float64Array}
 */
export function poisson2d(n) {
    const ret = wasm.poisson2d(n);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Prepare mass-mixture coefficient rows for the indexed vessel renderer.
 * @param {Float64Array} wavelengths_nm
 * @param {Float64Array} component_absorption_m2_kg
 * @param {Float64Array} mixture_mass_weights
 * @returns {Float64Array}
 */
export function prepare_vessel_spectral_absorption_mixtures(wavelengths_nm, component_absorption_m2_kg, mixture_mass_weights) {
    const ptr0 = passArrayF64ToWasm0(wavelengths_nm, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(component_absorption_m2_kg, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(mixture_mass_weights, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.prepare_vessel_spectral_absorption_mixtures(ptr0, len0, ptr1, len1, ptr2, len2);
    var v4 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v4;
}

/**
 * @param {number} alpha
 * @param {number} sigma
 * @param {number} n
 * @returns {Float64Array}
 */
export function proofrobust(alpha, sigma, n) {
    const ret = wasm.proofrobust(alpha, sigma, n);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} max_log2
 * @param {number} seed
 * @returns {Float64Array}
 */
export function qmc_vs_mc(max_log2, seed) {
    const ret = wasm.qmc_vs_mc(max_log2, seed);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} n
 * @param {number} rank
 * @param {number} seed
 * @returns {Float64Array}
 */
export function randomized_svd(n, rank, seed) {
    const ret = wasm.randomized_svd(n, rank, seed);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Physical radiance through captured mass and an explicit material map.
 * @param {Float64Array} mass_field
 * @param {Uint32Array} cell_materials
 * @param {number} nx
 * @param {number} ny
 * @param {number} resolution
 * @param {Float64Array} wavelengths_nm
 * @param {Float64Array} mass_absorption_m2_kg
 * @param {number} density_unit_kg_m3
 * @param {number} lattice_spacing_m
 * @param {number} slab_depth_m
 * @param {Float64Array} background_w_m2_sr_nm
 * @param {boolean} background_per_column
 * @returns {Float64Array}
 */
export function render_vessel_indexed_spectral_radiance(mass_field, cell_materials, nx, ny, resolution, wavelengths_nm, mass_absorption_m2_kg, density_unit_kg_m3, lattice_spacing_m, slab_depth_m, background_w_m2_sr_nm, background_per_column) {
    const ptr0 = passArrayF64ToWasm0(mass_field, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(cell_materials, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(wavelengths_nm, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF64ToWasm0(mass_absorption_m2_kg, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF64ToWasm0(background_w_m2_sr_nm, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ret = wasm.render_vessel_indexed_spectral_radiance(ptr0, len0, ptr1, len1, nx, ny, resolution, ptr2, len2, ptr3, len3, density_unit_kg_m3, lattice_spacing_m, slab_depth_m, ptr4, len4, background_per_column);
    var v6 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v6;
}

/**
 * Spectral SI absorption using explicit original cell material indices.
 * @param {Float64Array} mass_field
 * @param {Uint32Array} cell_materials
 * @param {number} nx
 * @param {number} ny
 * @param {number} resolution
 * @param {Float64Array} wavelengths_nm
 * @param {Float64Array} mass_absorption_m2_kg
 * @param {number} density_unit_kg_m3
 * @param {number} lattice_spacing_m
 * @param {number} slab_depth_m
 * @returns {Float64Array}
 */
export function render_vessel_indexed_spectral_transmittance(mass_field, cell_materials, nx, ny, resolution, wavelengths_nm, mass_absorption_m2_kg, density_unit_kg_m3, lattice_spacing_m, slab_depth_m) {
    const ptr0 = passArrayF64ToWasm0(mass_field, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(cell_materials, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(wavelengths_nm, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF64ToWasm0(mass_absorption_m2_kg, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ret = wasm.render_vessel_indexed_spectral_transmittance(ptr0, len0, ptr1, len1, nx, ny, resolution, ptr2, len2, ptr3, len3, density_unit_kg_m3, lattice_spacing_m, slab_depth_m);
    var v5 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v5;
}

/**
 * Approximate visible XYZ through captured mass and an explicit material map.
 * @param {Float64Array} mass_field
 * @param {Uint32Array} cell_materials
 * @param {number} nx
 * @param {number} ny
 * @param {number} resolution
 * @param {Float64Array} wavelengths_nm
 * @param {Float64Array} mass_absorption_m2_kg
 * @param {number} density_unit_kg_m3
 * @param {number} lattice_spacing_m
 * @param {number} slab_depth_m
 * @param {Float64Array} background_w_m2_sr_nm
 * @param {boolean} background_per_column
 * @param {Float64Array} quadrature_weights_nm
 * @returns {Float64Array}
 */
export function render_vessel_indexed_spectral_xyz(mass_field, cell_materials, nx, ny, resolution, wavelengths_nm, mass_absorption_m2_kg, density_unit_kg_m3, lattice_spacing_m, slab_depth_m, background_w_m2_sr_nm, background_per_column, quadrature_weights_nm) {
    const ptr0 = passArrayF64ToWasm0(mass_field, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(cell_materials, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(wavelengths_nm, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF64ToWasm0(mass_absorption_m2_kg, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF64ToWasm0(background_w_m2_sr_nm, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayF64ToWasm0(quadrature_weights_nm, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ret = wasm.render_vessel_indexed_spectral_xyz(ptr0, len0, ptr1, len1, nx, ny, resolution, ptr2, len2, ptr3, len3, density_unit_kg_m3, lattice_spacing_m, slab_depth_m, ptr4, len4, background_per_column, ptr5, len5);
    var v7 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v7;
}

/**
 * Physical radiance through captured mass, with explicit illumination layout.
 * @param {Float64Array} mass_field
 * @param {number} nx
 * @param {number} ny
 * @param {number} resolution
 * @param {Float64Array} wavelengths_nm
 * @param {Float64Array} mass_absorption_m2_kg
 * @param {number} density_unit_kg_m3
 * @param {number} lattice_spacing_m
 * @param {number} slab_depth_m
 * @param {Float64Array} background_w_m2_sr_nm
 * @param {boolean} background_per_column
 * @returns {Float64Array}
 */
export function render_vessel_spectral_radiance(mass_field, nx, ny, resolution, wavelengths_nm, mass_absorption_m2_kg, density_unit_kg_m3, lattice_spacing_m, slab_depth_m, background_w_m2_sr_nm, background_per_column) {
    const ptr0 = passArrayF64ToWasm0(mass_field, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(wavelengths_nm, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(mass_absorption_m2_kg, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF64ToWasm0(background_w_m2_sr_nm, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ret = wasm.render_vessel_spectral_radiance(ptr0, len0, nx, ny, resolution, ptr1, len1, ptr2, len2, density_unit_kg_m3, lattice_spacing_m, slab_depth_m, ptr3, len3, background_per_column);
    var v5 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v5;
}

/**
 * Spectral SI absorption of an existing captured mass frame.
 * @param {Float64Array} mass_field
 * @param {number} nx
 * @param {number} ny
 * @param {number} resolution
 * @param {Float64Array} wavelengths_nm
 * @param {Float64Array} mass_absorption_m2_kg
 * @param {number} density_unit_kg_m3
 * @param {number} lattice_spacing_m
 * @param {number} slab_depth_m
 * @returns {Float64Array}
 */
export function render_vessel_spectral_transmittance(mass_field, nx, ny, resolution, wavelengths_nm, mass_absorption_m2_kg, density_unit_kg_m3, lattice_spacing_m, slab_depth_m) {
    const ptr0 = passArrayF64ToWasm0(mass_field, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(wavelengths_nm, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(mass_absorption_m2_kg, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.render_vessel_spectral_transmittance(ptr0, len0, nx, ny, resolution, ptr1, len1, ptr2, len2, density_unit_kg_m3, lattice_spacing_m, slab_depth_m);
    var v4 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v4;
}

/**
 * Approximate visible XYZ with explicit source radiance and quadrature.
 * @param {Float64Array} mass_field
 * @param {number} nx
 * @param {number} ny
 * @param {number} resolution
 * @param {Float64Array} wavelengths_nm
 * @param {Float64Array} mass_absorption_m2_kg
 * @param {number} density_unit_kg_m3
 * @param {number} lattice_spacing_m
 * @param {number} slab_depth_m
 * @param {Float64Array} background_w_m2_sr_nm
 * @param {boolean} background_per_column
 * @param {Float64Array} quadrature_weights_nm
 * @returns {Float64Array}
 */
export function render_vessel_spectral_xyz(mass_field, nx, ny, resolution, wavelengths_nm, mass_absorption_m2_kg, density_unit_kg_m3, lattice_spacing_m, slab_depth_m, background_w_m2_sr_nm, background_per_column, quadrature_weights_nm) {
    const ptr0 = passArrayF64ToWasm0(mass_field, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(wavelengths_nm, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(mass_absorption_m2_kg, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF64ToWasm0(background_w_m2_sr_nm, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF64ToWasm0(quadrature_weights_nm, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ret = wasm.render_vessel_spectral_xyz(ptr0, len0, nx, ny, resolution, ptr1, len1, ptr2, len2, density_unit_kg_m3, lattice_spacing_m, slab_depth_m, ptr3, len3, background_per_column, ptr4, len4);
    var v6 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v6;
}

/**
 * Monochromatic SI absorption of an existing captured mass frame.
 * @param {Float64Array} mass_field
 * @param {number} nx
 * @param {number} ny
 * @param {number} resolution
 * @param {number} wavelength_nm
 * @param {number} mass_absorption_m2_kg
 * @param {number} density_unit_kg_m3
 * @param {number} lattice_spacing_m
 * @param {number} slab_depth_m
 * @returns {Float64Array}
 */
export function render_vessel_transmittance(mass_field, nx, ny, resolution, wavelength_nm, mass_absorption_m2_kg, density_unit_kg_m3, lattice_spacing_m, slab_depth_m) {
    const ptr0 = passArrayF64ToWasm0(mass_field, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.render_vessel_transmittance(ptr0, len0, nx, ny, resolution, wavelength_nm, mass_absorption_m2_kg, density_unit_kg_m3, lattice_spacing_m, slab_depth_m);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * @param {number} radius
 * @returns {Float64Array}
 */
export function robust_hull(radius) {
    const ret = wasm.robust_hull(radius);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} seed
 * @returns {Float64Array}
 */
export function run_frame(seed) {
    const ret = wasm.run_frame(seed);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} blowing_pressure_pa
 * @returns {Float64Array}
 */
export function run_instrument_reed(blowing_pressure_pa) {
    const ret = wasm.run_instrument_reed(blowing_pressure_pa);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Physical SI film study; JavaScript receives a typed-array result or an error.
 * @param {Float64Array} section_rows
 * @param {Float64Array} width_scales
 * @param {Float64Array} fluid_rows
 * @param {Float64Array} settings
 * @returns {Float64Array}
 */
export function run_laminar_vessel(section_rows, width_scales, fluid_rows, settings) {
    const ptr0 = passArrayF64ToWasm0(section_rows, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(width_scales, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(fluid_rows, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF64ToWasm0(settings, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ret = wasm.run_laminar_vessel(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v5 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v5;
}

/**
 * @param {number} seed
 * @returns {Float64Array}
 */
export function run_ornithoid(seed) {
    const ret = wasm.run_ornithoid(seed);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} lip_x1000
 * @returns {Float64Array}
 */
export function run_vessel(lip_x1000) {
    const ret = wasm.run_vessel(lip_x1000);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} windtunnel_latency
 * @param {number} design_b_mean
 * @param {number} stop_threshold
 * @returns {Float64Array}
 */
export function schedule_campaign(windtunnel_latency, design_b_mean, stop_threshold) {
    const ret = wasm.schedule_campaign(windtunnel_latency, design_b_mean, stop_threshold);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} res
 * @param {number} kind
 * @param {number} t
 * @returns {Float64Array}
 */
export function sdf_volume(res, kind, t) {
    const ret = wasm.sdf_volume(res, kind, t);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} threshold
 * @param {number} max_sensors
 * @param {number} b_prior_mean
 * @returns {Float64Array}
 */
export function sensorforge(threshold, max_sensors, b_prior_mean) {
    const ret = wasm.sensorforge(threshold, max_sensors, b_prior_mean);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} steps
 * @param {number} dt
 * @returns {Float64Array}
 */
export function symplectic_vs_euler(steps, dt) {
    const ret = wasm.symplectic_vs_euler(steps, dt);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} center
 * @param {number} radius
 * @param {number} order
 * @returns {Float64Array}
 */
export function taylor_bound(center, radius, order) {
    const ret = wasm.taylor_bound(center, radius, order);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} nx
 * @param {number} ny
 * @param {number} iters
 * @param {number} volfrac
 * @returns {Float64Array}
 */
export function topopt_frames(nx, ny, iters, volfrac) {
    const ret = wasm.topopt_frames(nx, ny, iters, volfrac);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} nx
 * @param {number} ny
 * @param {number} gap_tol
 * @returns {Float64Array}
 */
export function trusspath(nx, ny, gap_tol) {
    const ret = wasm.trusspath(nx, ny, gap_tol);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * @param {number} n
 * @param {number} frames
 * @param {number} steps_per_frame
 * @returns {Float64Array}
 */
export function wave2d_frames(n, frames, steps_per_frame) {
    const ret = wasm.wave2d_frames(n, frames, steps_per_frame);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_344f42d3211c4765: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./fs_wasm_bg.js": import0,
    };
}

const BrownianJsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_brownianjs_free(ptr, 1));
const Diffusion1dJsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_diffusion1djs_free(ptr, 1));
const PhiloxNormalsJsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_philoxnormalsjs_free(ptr, 1));

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat64ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('fs_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
