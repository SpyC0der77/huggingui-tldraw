# Scripting Nodes – Implementation Todo

## Completed

- [x] **Join** – Multiple text inputs + separator → concatenated string
- [x] **Delay** – Configurable delay (ms) before passing value through
- [x] **Random** – Random integer in [min, max] range (e.g. for seeds)

## Remaining Nodes (by difficulty)

### Easy

- [ ] **Conditional / Switch** – Boolean input → two outputs (true/false). Active branch gets value; inactive gets `STOP_EXECUTION`. Use case: branch by seed parity, model choice.
- [ ] **Pick First** – Multiple inputs → first non-null value. Use case: fallback prompts/models.
- [ ] **Merge** – Multiple inputs → one output (first non-null, last non-null, or concatenate). Use case: combining prompt sources.

### Medium

- [ ] **Split** – Text input + delimiter → multiple outputs (one per split item). Dynamic port count like Repeater. Use case: turn "a, b, c" into separate inputs. 
- [ ] **Index / Select** – List input + index → single item at that index. Use case: pick Nth result from batch.
- [ ] **Counter** – Outputs 0, 1, 2, … per execution run. Stateful. Use case: iteration index, unique IDs.
- [ ] **Template** – Template string + variable inputs → rendered string (e.g. `{{prompt}}`). Use case: prompt templates with placeholders.

### Hard

- [ ] **Nested Iterator** – Iterate over items where each item can be a sub-list. Requires ExecutionGraph changes. Use case: grids of prompts (styles × subjects).
- [ ] **Batch Collector** – Collect N outputs before passing to downstream. Stateful, multi-run execution. Use case: batching API calls.
- [ ] **Conditional Iterator** – Iterate only over items that pass a condition. Requires ExecutionGraph changes. Use case: filter items before generation.
- [ ] **Zip / Combine** – Two or more lists → paired items (e.g. prompts × models). Requires ExecutionGraph changes. Use case: Cartesian product of prompts and models.
