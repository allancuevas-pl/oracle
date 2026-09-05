import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * A back button that actually goes back.
 *
 * Every detail view hardcoded its destination — `navigate('/briefs')`,
 * `navigate('/clients')`. So opening a brief from a client record and pressing
 * back dropped you on the Briefs list instead of the client you came from, and
 * opening a deal from the pipeline lost the board. It was a "go to list"
 * button wearing a back arrow.
 *
 * `location.key` is `'default'` only for the first entry in this app's history
 * stack — a deep link, a fresh load, or a hard refresh. In that case there is
 * nothing of ours to go back to and `navigate(-1)` would throw the user out of
 * the app entirely, so we fall back to the list.
 *
 * @param {string} fallback route to use when there is no in-app history
 */
export function useGoBack(fallback) {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    if (location.key && location.key !== 'default') navigate(-1);
    else navigate(fallback);
  }, [navigate, location.key, fallback]);
}
