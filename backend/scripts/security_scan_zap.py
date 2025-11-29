#!/usr/bin/env python3
"""
OWASP ZAP Security Scan Automation Script

This script automates security scanning of the Chaski application using OWASP ZAP.
It performs spider scanning and active vulnerability scanning, then generates reports.

Requirements:
- OWASP ZAP installed and running in daemon mode
- pip install python-owasp-zap-v2.4

Usage:
    python scripts/security_scan_zap.py [--target TARGET] [--report-dir DIR]

Example:
    # Start ZAP daemon first
    zap.sh -daemon -port 8090 -config api.disablekey=true &

    # Run scan
    python scripts/security_scan_zap.py --target http://localhost:8000
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    from zapv2 import ZAPv2
except ImportError:
    print("Error: python-owasp-zap-v2.4 not installed")
    print("Install with: pip install python-owasp-zap-v2.4")
    sys.exit(1)


class ZAPScanner:
    """OWASP ZAP Scanner wrapper for Chaski application."""

    def __init__(self, target: str, zap_url: str = "http://127.0.0.1:8090", api_key: str = None):
        """
        Initialize ZAP scanner.

        Args:
            target: Target URL to scan (e.g., http://localhost:8000)
            zap_url: ZAP proxy URL
            api_key: ZAP API key (None if api.disablekey=true)
        """
        self.target = target
        self.zap = ZAPv2(apikey=api_key, proxies={
            'http': zap_url,
            'https': zap_url
        })

        # Test connection
        try:
            version = self.zap.core.version
            print(f"✓ Connected to ZAP version: {version}")
        except Exception as e:
            print(f"✗ Failed to connect to ZAP at {zap_url}")
            print(f"  Error: {e}")
            print("\nMake sure ZAP is running:")
            print("  zap.sh -daemon -port 8090 -config api.disablekey=true")
            sys.exit(1)

    def setup_context(self):
        """Set up scanning context for Chaski application."""
        print("\n📋 Setting up scan context...")

        # Remove old contexts
        for context in self.zap.context.context_list:
            if context == "Chaski":
                self.zap.context.remove_context("Chaski")

        # Create new context
        context_id = self.zap.context.new_context("Chaski")

        # Include URLs in context
        self.zap.context.include_in_context("Chaski", f"{self.target}.*")

        # Exclude logout and dangerous endpoints
        self.zap.context.exclude_from_context("Chaski", f"{self.target}/api/auth/logout")
        self.zap.context.exclude_from_context("Chaski", f"{self.target}/api/admin/.*")

        print(f"✓ Context 'Chaski' created (ID: {context_id})")
        return context_id

    def spider_scan(self, max_depth: int = 5):
        """
        Perform spider scan to discover application structure.

        Args:
            max_depth: Maximum depth to crawl
        """
        print(f"\n🕷️  Starting spider scan (max depth: {max_depth})...")

        # Configure spider
        self.zap.spider.set_option_max_depth(max_depth)

        # Start spider scan
        scan_id = self.zap.spider.scan(self.target)

        # Wait for spider to complete
        while int(self.zap.spider.status(scan_id)) < 100:
            progress = int(self.zap.spider.status(scan_id))
            print(f"  Spider progress: {progress}%", end='\r')
            time.sleep(2)

        print(f"✓ Spider scan complete: {progress}%      ")

        # Print discovered URLs
        urls = self.zap.spider.results(scan_id)
        print(f"  Discovered {len(urls)} URLs")

        return urls

    def active_scan(self, policy: str = "Default Policy"):
        """
        Perform active security scan for vulnerabilities.

        Args:
            policy: Scan policy to use
        """
        print(f"\n🔍 Starting active scan (policy: {policy})...")
        print("⚠️  This may take several minutes...")

        # Start active scan
        scan_id = self.zap.ascan.scan(self.target)

        # Wait for scan to complete
        last_progress = 0
        while int(self.zap.ascan.status(scan_id)) < 100:
            progress = int(self.zap.ascan.status(scan_id))
            if progress != last_progress:
                print(f"  Active scan progress: {progress}%", end='\r')
                last_progress = progress
            time.sleep(5)

        print(f"✓ Active scan complete: {progress}%      ")

        return scan_id

    def get_alerts(self):
        """Get all security alerts found during scanning."""
        alerts = self.zap.core.alerts(baseurl=self.target)

        # Categorize by risk
        categorized = {
            'High': [],
            'Medium': [],
            'Low': [],
            'Informational': []
        }

        for alert in alerts:
            risk = alert.get('risk', 'Informational')
            categorized[risk].append(alert)

        return alerts, categorized

    def print_summary(self, categorized_alerts):
        """Print summary of findings."""
        print("\n📊 Scan Results Summary")
        print("=" * 60)

        for risk_level in ['High', 'Medium', 'Low', 'Informational']:
            count = len(categorized_alerts[risk_level])
            icon = '🔴' if risk_level == 'High' else '🟠' if risk_level == 'Medium' else '🟡' if risk_level == 'Low' else '🔵'
            print(f"{icon} {risk_level}: {count} finding(s)")

        print("\n" + "=" * 60)

        # Print details for high and medium risks
        for risk_level in ['High', 'Medium']:
            alerts = categorized_alerts[risk_level]
            if alerts:
                print(f"\n{risk_level} Risk Findings:")
                print("-" * 60)
                for alert in alerts:
                    print(f"  • {alert['name']}")
                    print(f"    URL: {alert['url']}")
                    print(f"    CWE: {alert.get('cweid', 'N/A')}")
                    print()

    def generate_reports(self, report_dir: str):
        """
        Generate scan reports in multiple formats.

        Args:
            report_dir: Directory to save reports
        """
        print(f"\n📄 Generating reports...")

        # Create report directory
        report_path = Path(report_dir)
        report_path.mkdir(parents=True, exist_ok=True)

        # Generate timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # HTML Report
        html_report = report_path / f"zap_report_{timestamp}.html"
        with open(html_report, 'w') as f:
            f.write(self.zap.core.htmlreport())
        print(f"✓ HTML report: {html_report}")

        # JSON Report
        json_report = report_path / f"zap_report_{timestamp}.json"
        alerts = self.zap.core.alerts(baseurl=self.target)
        with open(json_report, 'w') as f:
            json.dump(alerts, f, indent=2)
        print(f"✓ JSON report: {json_report}")

        # XML Report
        xml_report = report_path / f"zap_report_{timestamp}.xml"
        with open(xml_report, 'w') as f:
            f.write(self.zap.core.xmlreport())
        print(f"✓ XML report: {xml_report}")

        # Markdown summary
        md_report = report_path / f"zap_summary_{timestamp}.md"
        self.generate_markdown_summary(md_report, alerts)
        print(f"✓ Markdown summary: {md_report}")

        return html_report

    def generate_markdown_summary(self, output_file: Path, alerts: list):
        """Generate a markdown summary of findings."""
        with open(output_file, 'w') as f:
            f.write(f"# Security Scan Report\n\n")
            f.write(f"**Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"**Target**: {self.target}\n\n")

            # Categorize alerts
            categorized = {
                'High': [],
                'Medium': [],
                'Low': [],
                'Informational': []
            }

            for alert in alerts:
                risk = alert.get('risk', 'Informational')
                categorized[risk].append(alert)

            f.write("## Summary\n\n")
            f.write(f"- 🔴 High: {len(categorized['High'])}\n")
            f.write(f"- 🟠 Medium: {len(categorized['Medium'])}\n")
            f.write(f"- 🟡 Low: {len(categorized['Low'])}\n")
            f.write(f"- 🔵 Informational: {len(categorized['Informational'])}\n\n")

            # Details for each risk level
            for risk_level in ['High', 'Medium', 'Low', 'Informational']:
                if categorized[risk_level]:
                    f.write(f"## {risk_level} Risk Findings\n\n")

                    for alert in categorized[risk_level]:
                        f.write(f"### {alert['name']}\n\n")
                        f.write(f"**Risk**: {alert['risk']}\n")
                        f.write(f"**Confidence**: {alert['confidence']}\n")
                        f.write(f"**CWE**: {alert.get('cweid', 'N/A')}\n")
                        f.write(f"**URL**: `{alert['url']}`\n\n")
                        f.write(f"**Description**: {alert['description']}\n\n")
                        f.write(f"**Solution**: {alert['solution']}\n\n")
                        f.write(f"---\n\n")

    def run_full_scan(self, report_dir: str = "reports"):
        """
        Run complete security scan: spider + active scan + reporting.

        Args:
            report_dir: Directory to save reports
        """
        print(f"\n🚀 Starting full security scan of {self.target}")
        print("=" * 60)

        start_time = time.time()

        # Setup context
        self.setup_context()

        # Spider scan
        self.spider_scan()

        # Active scan
        self.active_scan()

        # Get results
        alerts, categorized = self.get_alerts()

        # Print summary
        self.print_summary(categorized)

        # Generate reports
        report_file = self.generate_reports(report_dir)

        # Calculate duration
        duration = time.time() - start_time
        minutes = int(duration // 60)
        seconds = int(duration % 60)

        print(f"\n⏱️  Total scan time: {minutes}m {seconds}s")
        print(f"\n✅ Scan complete! Open report: {report_file}")

        # Return exit code based on findings
        high_risk_count = len(categorized['High'])
        if high_risk_count > 0:
            print(f"\n⚠️  WARNING: {high_risk_count} high-risk finding(s) detected!")
            return 1
        else:
            print(f"\n✅ No high-risk vulnerabilities detected")
            return 0


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="OWASP ZAP Security Scanner for Chaski",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full scan with default settings
  python scripts/security_scan_zap.py

  # Scan different target
  python scripts/security_scan_zap.py --target http://localhost:3000

  # Custom ZAP proxy and report directory
  python scripts/security_scan_zap.py --zap-url http://localhost:8091 --report-dir ./security-reports

Prerequisites:
  1. Start ZAP daemon:
     zap.sh -daemon -port 8090 -config api.disablekey=true

  2. Start Chaski backend:
     cd backend && uvicorn main:app --reload --port 8000
        """
    )

    parser.add_argument(
        '--target',
        default='http://localhost:8000',
        help='Target URL to scan (default: http://localhost:8000)'
    )

    parser.add_argument(
        '--zap-url',
        default='http://127.0.0.1:8090',
        help='ZAP proxy URL (default: http://127.0.0.1:8090)'
    )

    parser.add_argument(
        '--api-key',
        default=None,
        help='ZAP API key (optional, not needed if api.disablekey=true)'
    )

    parser.add_argument(
        '--report-dir',
        default='reports',
        help='Directory to save reports (default: reports)'
    )

    args = parser.parse_args()

    # Initialize scanner
    scanner = ZAPScanner(
        target=args.target,
        zap_url=args.zap_url,
        api_key=args.api_key
    )

    # Run scan
    exit_code = scanner.run_full_scan(report_dir=args.report_dir)

    sys.exit(exit_code)


if __name__ == '__main__':
    main()
