import { useEffect, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { TOTAL_WORTH_SHOWING, getActivity } from './activity';

/** The real number of orders delivered through PrintAir. Hidden until it is big enough to be worth saying. */
export function DeliveredTotal() {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    let live = true;
    void getActivity().then((a) => live && setTotal(a.deliveredTotal));
    return () => {
      live = false;
    };
  }, []);
  if (total < TOTAL_WORTH_SHOWING) return null;
  return (
    <p className="mx-auto flex max-w-6xl items-center gap-2 px-5 pb-6 font-bold text-ink-950 sm:px-8">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-leaf-200">
        <PackageCheck className="h-5 w-5" />
      </span>
      {total.toLocaleString('en-PH')} orders delivered through PrintAir
    </p>
  );
}
