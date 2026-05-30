export default function Loading() {
    return (
        <div className="item-page animate-pulse">
            <div className="item-hero">
                <div className="item-poster-wrap bg-[var(--background-card)]"></div>
                
                <div className="item-info">
                    <div className="h-10 bg-[var(--background-card)] rounded w-3/4 mb-4"></div>
                    
                    <div className="item-meta-row mb-4">
                        <div className="h-4 bg-[var(--background-card)] rounded w-24"></div>
                        <div className="h-4 bg-[var(--background-card)] rounded w-16"></div>
                    </div>
                    
                    <div className="item-meta-row mb-6">
                        <div className="h-6 bg-[var(--background-input)] rounded-full w-20"></div>
                        <div className="h-6 bg-[var(--background-input)] rounded-full w-24"></div>
                        <div className="h-6 bg-[var(--background-input)] rounded-full w-16"></div>
                    </div>
                    
                    <div className="h-8 bg-[var(--background-input)] rounded w-24 mb-6"></div>
                    
                    <div className="mt-6 flex flex-col gap-6">
                        <div>
                            <div className="h-4 bg-[var(--background-card)] rounded w-20 mb-2"></div>
                            <div className="h-4 bg-[var(--background-card)] rounded w-40"></div>
                        </div>
                        
                        <div>
                            <div className="h-4 bg-[var(--background-card)] rounded w-16 mb-2"></div>
                            <div className="flex gap-2">
                                <div className="h-8 bg-[var(--background-card)] rounded-full w-24"></div>
                                <div className="h-8 bg-[var(--background-card)] rounded-full w-32"></div>
                                <div className="h-8 bg-[var(--background-card)] rounded-full w-28"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
