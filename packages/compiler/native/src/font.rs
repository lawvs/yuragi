use std::collections::{BTreeMap, HashSet};

use itertools::Itertools;
use lyon_path::PathEvent;
use serde::Serialize;
use ttf_parser::Rect;

use crate::direction;

#[derive(Serialize, PartialEq, Clone, Debug)]
#[serde(rename_all = "lowercase")]
#[serde(tag = "ty", content = "spec")]
enum OutlineCmd {
    Move(f64, f64),
    Line(f64, f64),
    Quad {
        to: (f64, f64),
        ctrl: (f64, f64),
    },
    Cubic {
        to: (f64, f64),
        ctrl_first: (f64, f64),
        ctrl_second: (f64, f64),
    },
    Close,
}

impl OutlineCmd {
    fn dst_pt(&self) -> Option<(f64, f64)> {
        match self {
            OutlineCmd::Move(x, y) => Some((*x, *y)),
            OutlineCmd::Line(x, y) => Some((*x, *y)),
            OutlineCmd::Quad { to, .. } => Some(*to),
            OutlineCmd::Cubic { to, .. } => Some(*to),
            OutlineCmd::Close => None,
        }
    }

    fn may_be_inside(&self, path: impl Iterator<Item = PathEvent>) -> bool {
        match self.dst_pt() {
            None => true,
            Some((x, y)) => lyon_algorithms::hit_test::hit_test_path(
                &(x as f32, y as f32).into(),
                path,
                lyon_path::FillRule::EvenOdd,
                1e-5,
            ),
        }
    }
}

type Outline = Vec<OutlineCmd>;

#[derive(Serialize, Clone, Copy, Debug)]
pub struct GlyphBBox {
    pub top: i16,
    pub bottom: i16,
    pub left: i16,
    pub right: i16,
}

#[derive(Serialize, Clone, Debug)]
pub struct Shard {
    pub path: String,
    pub direction: (f32, f32),
}

#[derive(Serialize, Clone, Debug)]
pub struct ShardGlyph {
    pub char: char,
    pub advance: u16,
    pub bbox: GlyphBBox,
    pub shards: Vec<Shard>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ShardGroup {
    pub text: String,
    pub advance: u64,
    pub break_after: bool,
    pub glyphs: Vec<ShardGlyph>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TextOutline {
    pub em: u16,
    pub ascender: i16,
    pub descender: i16,
    pub groups: Vec<ShardGroup>,
}

fn serialize_outline(outline: &Outline) -> String {
    let mut ret = String::new();
    for cmd in outline {
        match cmd {
            OutlineCmd::Move(x, y) => {
                ret.push_str(&format!("M {} {}", x, -y));
            }
            OutlineCmd::Line(x, y) => {
                ret.push_str(&format!("L {} {}", x, -y));
            }
            OutlineCmd::Quad { to, ctrl } => {
                ret.push_str(&format!("Q {} {} {} {}", ctrl.0, -ctrl.1, to.0, -to.1));
            }
            OutlineCmd::Cubic {
                to,
                ctrl_first,
                ctrl_second,
            } => {
                ret.push_str(&format!(
                    "C {} {} {} {} {} {}",
                    ctrl_first.0, -ctrl_first.1, ctrl_second.0, -ctrl_second.1, to.0, -to.1
                ));
            }
            OutlineCmd::Close => {
                ret.push('Z');
            }
        }
    }
    ret
}

fn split_closed_loop<I: Iterator<Item = OutlineCmd>>(outline: I) -> Vec<Outline> {
    let mut output = Vec::new();
    let mut cur = Vec::new();

    for cmd in outline {
        let is_close = cmd == OutlineCmd::Close;
        cur.push(cmd);
        if is_close {
            output.push(cur);
            cur = Vec::new();
        }
    }

    if !cur.is_empty() {
        cur.push(OutlineCmd::Close);
        output.push(cur);
    }

    output
}

fn component_to_lyon_path_ev<I: Iterator<Item = OutlineCmd>>(
    outline: I,
) -> impl Iterator<Item = PathEvent> {
    let mut start = (0.0, 0.0).into();
    let mut last = (0.0, 0.0).into();
    outline.map(move |cmd| match cmd {
        OutlineCmd::Move(x, y) => {
            start = (x as f32, y as f32).into();
            last = (x as f32, y as f32).into();
            PathEvent::Begin {
                at: (x as f32, y as f32).into(),
            }
        }
        OutlineCmd::Line(x, y) => {
            let current = (x as f32, y as f32).into();
            let output = PathEvent::Line {
                from: last,
                to: current,
            };
            last = current;
            output
        }
        OutlineCmd::Quad { to, ctrl } => {
            let current = (to.0 as f32, to.1 as f32).into();
            let output = PathEvent::Quadratic {
                from: last,
                to: current,
                ctrl: (ctrl.0 as f32, ctrl.1 as f32).into(),
            };
            last = current;
            output
        }
        OutlineCmd::Cubic {
            to,
            ctrl_first,
            ctrl_second,
        } => {
            let current = (to.0 as f32, to.1 as f32).into();
            let output = PathEvent::Cubic {
                from: last,
                to: current,
                ctrl1: (ctrl_first.0 as f32, ctrl_first.1 as f32).into(),
                ctrl2: (ctrl_second.0 as f32, ctrl_second.1 as f32).into(),
            };
            last = current;
            output
        }
        OutlineCmd::Close => {
            let output = PathEvent::End {
                last,
                first: start,
                close: true,
            };
            start = (0.0, 0.0).into();
            last = (0.0, 0.0).into();
            output
        }
    })
}

fn collect_outline(
    id: usize,
    outlines: &[Outline],
    children: &[Vec<usize>],
    collect: &mut Vec<Outline>,
) {
    let mut current = outlines[id].clone();
    for child in children[id].iter() {
        current.extend(outlines[*child].iter().cloned());
        for double_child in children[*child].iter() {
            collect_outline(*double_child, outlines, children, collect);
        }
    }
    collect.push(current);
}

fn split_components(input: Outline) -> Vec<Outline> {
    let loops = split_closed_loop(input.into_iter());
    let mut inside: Vec<HashSet<usize>> = loops.iter().map(|_| HashSet::new()).collect();

    for i in 0..loops.len() {
        for j in 0..loops.len() {
            if i == j {
                continue;
            }

            let i_inside_j = loops[i].iter().all(|cmd| {
                cmd.may_be_inside(component_to_lyon_path_ev(loops[j].iter().cloned()))
            });
            if i_inside_j {
                inside[i].insert(j);
            }
        }
    }

    let mut processed: Vec<bool> = loops.iter().map(|_| false).collect();
    let mut is_root: Vec<bool> = loops.iter().map(|_| true).collect();
    let mut children: Vec<Vec<usize>> = loops.iter().map(|_| Vec::new()).collect();

    loop {
        let mut selected = None;
        for i in 0..inside.len() {
            if inside[i].is_empty() && !processed[i] {
                selected = Some(i);
                break;
            }
        }

        let selected = if let Some(inner) = selected {
            inner
        } else {
            break;
        };

        for i in 0..inside.len() {
            if inside[i].remove(&selected) && inside[i].is_empty() {
                children[selected].push(i);
                is_root[i] = false;
            }
        }

        processed[selected] = true;
    }

    let mut collected = Vec::new();
    for i in 0..loops.len() {
        if is_root[i] {
            collect_outline(i, &loops, &children, &mut collected);
        }
    }

    collected
}

#[derive(Default)]
struct OutlineBuilder {
    outline: Outline,
}

impl ttf_parser::OutlineBuilder for OutlineBuilder {
    fn move_to(&mut self, x: f32, y: f32) {
        self.outline.push(OutlineCmd::Move(x as f64, y as f64));
    }

    fn line_to(&mut self, x: f32, y: f32) {
        self.outline.push(OutlineCmd::Line(x as f64, y as f64));
    }

    fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
        self.outline.push(OutlineCmd::Quad {
            to: (x as f64, y as f64),
            ctrl: (x1 as f64, y1 as f64),
        });
    }

    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
        self.outline.push(OutlineCmd::Cubic {
            to: (x as f64, y as f64),
            ctrl_first: (x1 as f64, y1 as f64),
            ctrl_second: (x2 as f64, y2 as f64),
        });
    }

    fn close(&mut self) {
        self.outline.push(OutlineCmd::Close);
    }
}

pub fn parse_char(c: char, face: &ttf_parser::Face) -> anyhow::Result<ShardGlyph> {
    let glyph = face
        .glyph_index(c)
        .ok_or_else(|| anyhow::anyhow!("Glyph \"{}\" not found in font", c))?;
    let mut builder = OutlineBuilder::default();

    let bbox = match face.outline_glyph(glyph, &mut builder) {
        Some(bbox) => bbox,
        None => Rect {
            x_min: 0,
            x_max: 0,
            y_min: 0,
            y_max: 0,
        },
    };

    let advance = face
        .glyph_hor_advance(glyph)
        .ok_or_else(|| anyhow::anyhow!("Glyph '{}' has no outline and hor adv", c))?;

    let mut components = split_components(builder.outline);
    components.sort_by(|a, b| {
        let a_bbox: lyon_path::geom::euclid::Box2D<f32, lyon_path::geom::euclid::UnknownUnit> =
            lyon_algorithms::aabb::bounding_box(component_to_lyon_path_ev(a.iter().cloned()));
        let b_bbox: lyon_path::geom::euclid::Box2D<f32, lyon_path::geom::euclid::UnknownUnit> =
            lyon_algorithms::aabb::bounding_box(component_to_lyon_path_ev(b.iter().cloned()));
        a_bbox.min.x.partial_cmp(&b_bbox.min.x).unwrap()
    });

    let shards = components
        .iter()
        .map(|component| {
            let path = serialize_outline(component);
            let direction = direction::compute_direction(
                &lyon_path::Path::from_iter(component_to_lyon_path_ev(component.iter().cloned())),
                1e-1,
            );
            Shard { path, direction }
        })
        .collect();

    Ok(ShardGlyph {
        char: c,
        advance,
        bbox: GlyphBBox {
            top: -bbox.y_max,
            bottom: -bbox.y_min,
            left: bbox.x_min,
            right: bbox.x_max,
        },
        shards,
    })
}

pub fn parse_text(text: &str, face: &ttf_parser::Face) -> anyhow::Result<TextOutline> {
    use unicode_segmentation::UnicodeSegmentation;

    let mut segmented: BTreeMap<usize, bool> = text
        .split_word_bound_indices()
        .map(|(i, _)| (i, false))
        .collect();

    for (i, opportunity) in unicode_linebreak::linebreaks(text) {
        if opportunity == unicode_linebreak::BreakOpportunity::Allowed || i == text.len() {
            segmented.insert(i, true);
        } else {
            anyhow::bail!(
                "unexpected mandatory line break at byte {} before end of text {:?}",
                i,
                text
            );
        }
    }

    let segs = segmented
        .iter()
        .tuple_windows()
        .map(|((aptr, _), (bptr, break_after))| (&text[*aptr..*bptr], *break_after));

    let groups = segs
        .map(|(s, break_after)| -> anyhow::Result<ShardGroup> {
            let glyphs = s
                .chars()
                .map(|c| parse_char(c, face))
                .collect::<anyhow::Result<Vec<_>>>()?;
            let advance = glyphs.iter().map(|glyph| glyph.advance as u64).sum();
            Ok(ShardGroup {
                text: s.to_string(),
                advance,
                break_after,
                glyphs,
            })
        })
        .collect::<anyhow::Result<Vec<_>>>()?;

    Ok(TextOutline {
        em: face.units_per_em(),
        ascender: face.ascender(),
        descender: face.descender(),
        groups,
    })
}
