# Cashflow

A cashflow forecaster. Define your recurring and one-off income and expenses, then watch
your projected balance roll out over the months ahead. Build several scenarios and overlay
them on one chart to compare what-ifs side by side.

## What it's for

Cashflow answers "where will my balance be in six months, and what happens if I change
something?" Instead of a static budget, you model the actual events that move money:
a biweekly paycheck, a monthly mortgage, weekly groceries, a one-off tax bill. The app
projects them onto a timeline and accumulates a running balance, so you can see the dips
and runways before they arrive.

## How it works

- **Timeline.** Set one start date and a horizon (in months). Every scenario is projected
  over that same window so they're directly comparable.
- **Scenarios.** Each scenario has its own opening balance, opening date, and list of items.
  Toggle a scenario's checkbox to show or hide it on the chart and table; duplicate one to
  branch and tweak. "Baseline" vs "with side income" vs "after the move" all live together.
- **Items.** An item is a named amount with a cadence:
  - **Monthly** on a given day of the month, from a start month.
  - **Weekly / biweekly** stepping from an anchor date.
  - **One-off** on a single date.
  - Any item can have an optional end date, be toggled off without deleting it, and a
    positive (income) or negative (expense) amount.
- **Chart + schedule.** The projected balance for every visible scenario overlays on one
  chart, and a dated table lists each transaction with the running balance (negative
  balances flagged in red).

## Your data

Everything lives in one JSON file in your workspace, so it syncs across your devices and
stays yours. **Import** a JSON export from the previous version of this app (or a bare list
of items) and it loads right in; **Export** writes the same interchangeable format back out.

## Source

Cashflow is open source: [github.com/generaltext/cashflow](https://github.com/generaltext/cashflow).
