import type { SceneSpec } from '@/lib/topics/matrix/scenes';
import { DimensionMatch } from './DimensionMatch';
import { GridTransform } from './GridTransform';
import { InverseRecipe } from './InverseRecipe';
import { RowColDot } from './RowColDot';
import { WorkedSolution } from './WorkedSolution';

/** Pure on its spec and beat: the same two always draw the same frame (SCENES §2). */
export function SceneStage({ spec, beat }: { spec: SceneSpec; beat: string }) {
  switch (spec.template) {
    case 'row_col_dot':
      return <RowColDot spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'dimension_match':
      return <DimensionMatch spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'grid_transform':
      return <GridTransform spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'inverse_recipe':
      return <InverseRecipe spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'worked_solution':
      return <WorkedSolution spec={spec} beat={beat as (typeof spec.beats)[number]} />;
  }
}
