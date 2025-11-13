# Page snapshot

```yaml
- dialog "Unhandled Runtime Error" [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - navigation [ref=e7]:
          - button "previous" [disabled] [ref=e8]:
            - img "previous" [ref=e9]
          - button "next" [disabled] [ref=e11]:
            - img "next" [ref=e12]
          - generic [ref=e14]: 1 of 1 error
          - generic [ref=e15]:
            - text: Next.js (14.2.33) is outdated
            - link "(learn more)" [ref=e17] [cursor=pointer]:
              - /url: https://nextjs.org/docs/messages/version-staleness
        - button "Close" [ref=e18] [cursor=pointer]:
          - img [ref=e20]
      - heading "Unhandled Runtime Error" [level=1] [ref=e23]
      - paragraph [ref=e24]: "TypeError: can't access property \"map\", widget.items is undefined"
    - generic [ref=e25]:
      - heading "Source" [level=2] [ref=e26]
      - generic [ref=e27]:
        - link "src/components/dashboard/widgets/PendingApprovalsWidget.tsx (211:41) @ widget" [ref=e29] [cursor=pointer]:
          - generic [ref=e30]: src/components/dashboard/widgets/PendingApprovalsWidget.tsx (211:41) @ widget
          - img [ref=e31]
        - generic [ref=e35]: "209 | 210 | // Mock approval items - in real app would come from widget.items > 211 | const approvalItems: ApprovalItem[] = widget.items.map((item) => ({ | ^ 212 | id: item.id, 213 | type: (item.metadata?.type as ApprovalItem['type']) || 'document', 214 | name: item.title,"
      - heading "Call Stack" [level=2] [ref=e36]
      - button "Show collapsed frames" [ref=e37] [cursor=pointer]
```