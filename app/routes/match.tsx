import { CatSort } from '~/components/match/CatSort';
import { V2_MetaFunction } from '@shopify/remix-oxygen';

export const meta: V2_MetaFunction = () => {
    return [{ title: `Hydrogen | Match` }];
};

export default function MatchPage() {
    return (
        <div className="search">
            <h1>Search</h1>
            <CatSort />
        </div>
    );
}

