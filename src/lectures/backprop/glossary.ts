import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  L: {
    is: 'the loss: data and weights in, one number out',
    more: 'The function whose gradient this chapter is after. Running it again for every nudged weight is the slow, numerical way to get dW.',
  },
  forward: {
    is: 'runs the network forward: the loss, plus a cache',
    more: 'The cache keeps the intermediate values the backward pass needs, so nothing is recomputed.',
  },
  backward: {
    is: 'walks the network backward to get the gradients',
    more: 'It starts from a gradient of 1.0 on the loss and applies the chain rule stage by stage, using the cached values; dX comes free with dW. The name says it: the error signal propagates backward, from the loss to every weight.',
  },
  '.forward': {
    is: 'one gate\'s forward pass: output now, inputs cached',
    more: 'A gate sees only its own inputs. MultiplyGate.forward stores x and y, which its backward pass needs as local gradients, and returns x * y; gates run forward in graph order.',
  },
  '.backward': {
    is: 'one gate\'s backward pass: upstream times local',
    more: 'A course-defined gate method, not autograd. It multiplies the upstream gradient dout into each local gradient (MultiplyGate returns y * dout and x * dout); gates run backward in reverse order.',
  },
  affine_forward: {
    is: 'a fully connected layer: x times w, plus b',
    more: 'Returns the output and a cache of its inputs for affine_backward. Affine means linear plus a shift: the multiply is linear, and adding b shifts it.',
  },
  affine_backward: {
    is: 'a fully connected layer backward: dx, dw and db',
    more: 'Multiplies the upstream gradient dout by local gradients built from the cached inputs. Each gradient has the shape of its variable, which pins down the transposes; db sums dout over the batch.',
  },
};
