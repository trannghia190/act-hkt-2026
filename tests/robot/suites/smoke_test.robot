*** Settings ***
Documentation    Smoke test for Robot Framework installation and environment
Library          OperatingSystem

*** Test Cases ***
Verify Robot Framework Installation
    Log    Robot Framework is working properly!
    Should Be True    ${TRUE}
