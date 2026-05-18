"""Experience timeline metrics."""

from __future__ import annotations

from datetime import datetime

from app.models.canonical import ResumeExperience, TimelineMetrics


def _parse_ym(value: str | None) -> datetime | None:
    if not value or value == "present":
        return datetime.now() if value == "present" else None
    try:
        if len(value) == 4:
            return datetime(int(value), 1, 1)
        parts = value.split("-")
        year = int(parts[0])
        month = int(parts[1]) if len(parts) > 1 else 1
        return datetime(year, month, 1)
    except (ValueError, IndexError):
        return None


def months_between(start: datetime, end: datetime) -> int:
    return max(0, (end.year - start.year) * 12 + end.month - start.month)


def compute_timeline(experience: list[ResumeExperience]) -> TimelineMetrics:
    if not experience:
        return TimelineMetrics()

    intervals: list[tuple[datetime, datetime, ResumeExperience]] = []
    for exp in experience:
        start = _parse_ym(exp.start_date)
        end = _parse_ym(exp.end_date) or datetime.now()
        if not start:
            continue
        if end < start:
            end = start
        months = months_between(start, end)
        exp.duration_months = months
        intervals.append((start, end, exp))

    if not intervals:
        return TimelineMetrics()

    intervals.sort(key=lambda x: x[0])
    total_months = sum(months_between(s, e) for s, e, _ in intervals)
    tenures = [months_between(s, e) for s, e, _ in intervals if months_between(s, e) > 0]
    avg_tenure = sum(tenures) / len(tenures) if tenures else 0.0

    gaps: list[int] = []
    for i in range(1, len(intervals)):
        prev_end = intervals[i - 1][1]
        next_start = intervals[i][0]
        gap = months_between(prev_end, next_start)
        if gap > 2:
            gaps.append(gap)

    current = intervals[-1][2]
    current_title = current.title.value if current.title else None
    current_company = current.company.value if current.company else None

    stability: str = "unknown"
    if tenures:
        short_roles = sum(1 for t in tenures if t < 12)
        if short_roles >= 3:
            stability = "volatile"
        elif avg_tenure >= 30:
            stability = "stable"
        else:
            stability = "moderate"

    velocity: str = "unknown"
    if len(intervals) >= 2:
        titles = [
            e.title.value.lower()
            for _, _, e in intervals
            if e.title and e.title.value
        ]
        if any("senior" in t or "lead" in t or "principal" in t for t in titles[-2:]):
            velocity = "fast"
        elif len(intervals) >= 4 and avg_tenure < 18:
            velocity = "slow"
        else:
            velocity = "normal"

    return TimelineMetrics(
        total_experience_months=total_months,
        total_experience_years=round(total_months / 12.0, 1),
        average_tenure_months=round(avg_tenure, 1),
        career_gaps_months=gaps,
        growth_velocity=velocity,
        career_stability=stability,
        current_role_title=current_title,
        current_role_company=current_company,
    )
