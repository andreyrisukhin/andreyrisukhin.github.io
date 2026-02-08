use bevy::prelude::*;

use crate::constants::TILE_SIZE;

#[derive(Resource, Clone)]
pub struct Level {
    pub width: i32,
    pub height: i32,
    tiles: Vec<bool>,
}

impl Default for Level {
    fn default() -> Self {
        Self::from_ascii(&[
            "####################",
            "#........#.........#",
            "#.######.#.#####.#.#",
            "#.#....#.#.....#.#.#",
            "#.#.##.#.#####.#.#.#",
            "#.#.#..#.....#.#...#",
            "#...#.#######.#####.",
            "###.#...............",
            "#...###########.####",
            "#...............#..#",
            "####################",
        ])
    }
}

impl Level {
    pub fn from_ascii(lines: &[&str]) -> Self {
        let height = lines.len() as i32;
        let width = lines.first().map(|line| line.len()).unwrap_or(0) as i32;
        let mut tiles = vec![false; (width * height) as usize];

        for (row, line) in lines.iter().enumerate() {
            for (col, ch) in line.chars().enumerate() {
                let x = col as i32;
                let y = height - 1 - row as i32;
                let idx = (y * width + x) as usize;
                tiles[idx] = ch == '#';
            }
        }

        Self {
            width,
            height,
            tiles,
        }
    }

    pub fn to_ascii(&self) -> String {
        let mut out = String::new();
        for row in (0..self.height).rev() {
            for col in 0..self.width {
                out.push(if self.is_wall(col, row) { '#' } else { '.' });
            }
            out.push('\n');
        }
        out
    }

    pub fn toggle_wall_at(&mut self, tile: IVec2) {
        if !self.in_bounds(tile) {
            return;
        }
        let idx = self.index(tile);
        self.tiles[idx] = !self.tiles[idx];
    }

    pub fn is_wall(&self, x: i32, y: i32) -> bool {
        if !self.in_bounds(IVec2::new(x, y)) {
            return false;
        }
        self.tiles[(y * self.width + x) as usize]
    }

    pub fn in_bounds(&self, tile: IVec2) -> bool {
        tile.x >= 0 && tile.x < self.width && tile.y >= 0 && tile.y < self.height
    }

    pub fn world_bounds(&self) -> (Vec2, Vec2) {
        let half = Vec2::new(self.width as f32, self.height as f32) * TILE_SIZE * 0.5;
        (Vec2::new(-half.x, -half.y), Vec2::new(half.x, half.y))
    }

    pub fn origin(&self) -> Vec2 {
        let half = Vec2::new(self.width as f32, self.height as f32) * TILE_SIZE * 0.5;
        Vec2::new(-half.x + TILE_SIZE * 0.5, -half.y + TILE_SIZE * 0.5)
    }

    pub fn world_to_tile(&self, world: Vec2) -> IVec2 {
        let local = world - self.origin();
        IVec2::new((local.x / TILE_SIZE).floor() as i32, (local.y / TILE_SIZE).floor() as i32)
    }

    pub fn tile_center(&self, tile: IVec2) -> Vec2 {
        self.origin()
            + Vec2::new(tile.x as f32 * TILE_SIZE, tile.y as f32 * TILE_SIZE)
    }

    fn index(&self, tile: IVec2) -> usize {
        (tile.y * self.width + tile.x) as usize
    }
}
