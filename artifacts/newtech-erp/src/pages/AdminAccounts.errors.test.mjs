import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCOUNT_MUTATION_ERROR_FALLBACKS,
  createAccountMutationErrorHandlers,
} from '../lib/accountMutationErrors.ts';

const mutationNames = ['profile', 'password', 'createSeller', 'updateSeller', 'deleteSeller'];

function captureMutationFeedback() {
  const feedback = {};
  const setters = Object.fromEntries(
    mutationNames.map((name) => [name, (value) => { feedback[name] = value; }]),
  );

  return {
    feedback,
    handlers: createAccountMutationErrorHandlers(setters),
  };
}

for (const mutationName of mutationNames) {
  test(`${mutationName} mutation shows the server error in error feedback`, () => {
    const { feedback, handlers } = captureMutationFeedback();

    handlers[mutationName]({ data: { message: `Server rejected ${mutationName}.` } });

    assert.deepEqual(feedback[mutationName], {
      type: 'error',
      text: `Server rejected ${mutationName}.`,
    });
  });

  test(`${mutationName} mutation uses its contextual fallback for a blank server message`, () => {
    const { feedback, handlers } = captureMutationFeedback();

    handlers[mutationName]({ data: { message: '   ' } });

    assert.deepEqual(feedback[mutationName], {
      type: 'error',
      text: ACCOUNT_MUTATION_ERROR_FALLBACKS[mutationName],
    });
  });

  test(`${mutationName} mutation uses its contextual fallback when the server message is missing`, () => {
    const { feedback, handlers } = captureMutationFeedback();

    handlers[mutationName](undefined);

    assert.deepEqual(feedback[mutationName], {
      type: 'error',
      text: ACCOUNT_MUTATION_ERROR_FALLBACKS[mutationName],
    });
  });
}
