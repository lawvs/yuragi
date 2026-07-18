// Portions derived from CircuitCoder/layered under the MIT License:
// https://github.com/CircuitCoder/layered/blob/813afc3296ca0c82f3556d02b0140b9fce8f8a96/gen/src/direction.rs
// Copyright (c) 2025 Liu Xiaoyi
// SPDX-License-Identifier: MIT

use lyon_algorithms::measure::{PathMeasurements, SampleType};
use lyon_path::Path;

trait Integration {
    fn eval(&mut self, x: f32, y: f32, dx: f32, dy: f32) -> f32;
}

fn integrate_over<I: Integration>(mut f: I, p: &Path, eps: f32) -> f32 {
    let measurement = PathMeasurements::from_path(p, eps);
    let mut sampler = measurement.create_sampler(p, SampleType::Distance);
    let total_dist = sampler.length();
    let mut cur = 0.0;
    let mut int = 0.0;

    while cur < total_dist {
        let step = eps.min(total_dist - cur);
        let mid = sampler.sample(cur + step / 2.0);
        let x = mid.position().x;
        let y = mid.position().y;
        let dx = mid.tangent().x * step;
        let dy = mid.tangent().y * step;
        int += f.eval(x, y, dx, dy);
        cur += step;
    }

    int
}

struct AreaIntegration;
struct A2ExIntegration;
struct NA2EyIntegration;
struct A3Ex2Integration;
struct NA3Ey2Integration;
struct A4ExyIntegration;

impl Integration for AreaIntegration {
    fn eval(&mut self, x: f32, _y: f32, _dx: f32, dy: f32) -> f32 {
        x * dy
    }
}

impl Integration for A2ExIntegration {
    fn eval(&mut self, x: f32, _y: f32, _dx: f32, dy: f32) -> f32 {
        x * x * dy
    }
}

impl Integration for NA2EyIntegration {
    fn eval(&mut self, _x: f32, y: f32, dx: f32, _dy: f32) -> f32 {
        y * y * dx
    }
}

impl Integration for A3Ex2Integration {
    fn eval(&mut self, x: f32, _y: f32, _dx: f32, dy: f32) -> f32 {
        x * x * x * dy
    }
}

impl Integration for NA3Ey2Integration {
    fn eval(&mut self, _x: f32, y: f32, dx: f32, _dy: f32) -> f32 {
        y * y * y * dx
    }
}

impl Integration for A4ExyIntegration {
    fn eval(&mut self, x: f32, y: f32, dx: f32, dy: f32) -> f32 {
        x * x * y * dy - x * y * y * dx
    }
}

struct CovMat {
    var_x: f32,
    var_y: f32,
    cov_xy: f32,
}

fn compute_covmat(p: &Path, eps: f32) -> CovMat {
    let area = integrate_over(AreaIntegration, p, eps);
    let ex = integrate_over(A2ExIntegration, p, eps) / area / 2.0;
    let ey = -integrate_over(NA2EyIntegration, p, eps) / area / 2.0;
    let ex2 = integrate_over(A3Ex2Integration, p, eps) / area / 3.0;
    let ey2 = -integrate_over(NA3Ey2Integration, p, eps) / area / 3.0;
    let exy = integrate_over(A4ExyIntegration, p, eps) / area / 4.0;

    CovMat {
        var_x: ex2 - ex * ex,
        var_y: ey2 - ey * ey,
        cov_xy: exy - ex * ey,
    }
}

pub fn compute_direction(p: &Path, eps: f32) -> (f32, f32) {
    let cov = compute_covmat(p, eps);
    let det = cov.var_x * cov.var_y - cov.cov_xy * cov.cov_xy;
    let mean_trace = (cov.var_x + cov.var_y) / 2.0;
    let discriminant = (mean_trace * mean_trace - det).max(0.0);
    let larger_ev = mean_trace + discriminant.sqrt();
    let shorter_ev = mean_trace - discriminant.sqrt();

    if larger_ev < eps {
        return (0.0, 0.0);
    }

    let eigenvector_x = cov.cov_xy;
    let eigenvector_y = larger_ev - cov.var_x;
    let eigenvector_len = (eigenvector_x * eigenvector_x + eigenvector_y * eigenvector_y).sqrt();

    if eigenvector_len < eps {
        return (0.0, 0.0);
    }

    let wanted_len = 1.0 - (shorter_ev / larger_ev).abs().sqrt();

    (
        eigenvector_x / eigenvector_len * wanted_len,
        eigenvector_y / eigenvector_len * wanted_len,
    )
}
