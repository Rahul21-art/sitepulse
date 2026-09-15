--
-- PostgreSQL database dump
--

\restrict AgWj21FzfnX6pPjFsfNALf8XTLmWqwAmYhWae5aabxVJrSgYkJUjwGxu0XwXeTj

-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_matches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_matches (
    match_id character varying(10) NOT NULL,
    event_id character varying(10) NOT NULL,
    activity_id character varying(10),
    match_rank integer DEFAULT 1 NOT NULL,
    match_confidence numeric(3,2) NOT NULL,
    match_method character varying(20) DEFAULT 'keyword'::character varying NOT NULL,
    is_selected boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT activity_matches_match_confidence_check CHECK (((match_confidence >= (0)::numeric) AND (match_confidence <= (1)::numeric))),
    CONSTRAINT activity_matches_match_method_check CHECK (((match_method)::text = ANY ((ARRAY['keyword'::character varying, 'fuzzy'::character varying, 'embedding'::character varying, 'manual'::character varying])::text[])))
);


ALTER TABLE public.activity_matches OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    audit_id character varying(10) NOT NULL,
    entity_table character varying(30) NOT NULL,
    entity_id character varying(10) NOT NULL,
    action character varying(20) NOT NULL,
    field_changed character varying(50),
    old_value text,
    new_value text,
    changed_by character varying(50) NOT NULL,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    remarks text,
    CONSTRAINT audit_logs_action_check CHECK (((action)::text = ANY ((ARRAY['CREATE'::character varying, 'UPDATE'::character varying, 'REVIEW'::character varying, 'OVERRIDE'::character varying, 'DELETE'::character varying])::text[]))),
    CONSTRAINT audit_logs_entity_table_check CHECK (((entity_table)::text = ANY ((ARRAY['site_reports'::character varying, 'project_activities'::character varying, 'progress_events'::character varying, 'activity_matches'::character varying])::text[])))
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: progress_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.progress_events (
    event_id character varying(10) NOT NULL,
    report_id character varying(10) NOT NULL,
    normalized_date date,
    activity_mention_text character varying(255) NOT NULL,
    extracted_status character varying(20) NOT NULL,
    extracted_progress_pct numeric(5,2),
    pct_is_estimated boolean DEFAULT false NOT NULL,
    extraction_confidence numeric(3,2) NOT NULL,
    extraction_method character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT progress_events_extracted_progress_pct_check CHECK (((extracted_progress_pct IS NULL) OR ((extracted_progress_pct >= (0)::numeric) AND (extracted_progress_pct <= (100)::numeric)))),
    CONSTRAINT progress_events_extracted_status_check CHECK (((extracted_status)::text = ANY ((ARRAY['not_started'::character varying, 'in_progress'::character varying, 'delayed'::character varying, 'complete'::character varying, 'ambiguous'::character varying])::text[]))),
    CONSTRAINT progress_events_extraction_confidence_check CHECK (((extraction_confidence >= (0)::numeric) AND (extraction_confidence <= (1)::numeric))),
    CONSTRAINT progress_events_extraction_method_check CHECK (((extraction_method)::text = ANY ((ARRAY['rule_based'::character varying, 'llm'::character varying, 'manual'::character varying])::text[])))
);


ALTER TABLE public.progress_events OWNER TO postgres;

--
-- Name: project_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_activities (
    activity_id character varying(10) NOT NULL,
    activity_name character varying(255) NOT NULL,
    discipline character varying(50) NOT NULL,
    planned_start_date date NOT NULL,
    planned_end_date date NOT NULL,
    CONSTRAINT ck_activity_dates CHECK ((planned_end_date >= planned_start_date))
);


ALTER TABLE public.project_activities OWNER TO postgres;

--
-- Name: site_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_reports (
    report_id character varying(10) NOT NULL,
    report_date character varying(20) NOT NULL,
    reported_by character varying(50),
    weather character varying(20),
    raw_report_text text NOT NULL
);


ALTER TABLE public.site_reports OWNER TO postgres;

--
-- Data for Name: activity_matches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_matches (match_id, event_id, activity_id, match_rank, match_confidence, match_method, is_selected, created_at) FROM stdin;
AM-001	PE-001	ACT-002	1	0.92	keyword	t	2026-09-15 10:24:40
AM-002	PE-002	ACT-004	1	0.90	keyword	t	2026-09-15 10:24:40
AM-003	PE-003	ACT-005	1	0.88	keyword	t	2026-09-15 10:24:40
AM-004	PE-004	ACT-006	1	0.80	keyword	t	2026-09-15 10:24:40
AM-005	PE-005	ACT-006	1	0.90	keyword	t	2026-09-15 10:24:40
AM-006	PE-006	ACT-007	1	0.55	keyword	f	2026-09-15 10:24:40
AM-007	PE-006	ACT-005	2	0.30	keyword	f	2026-09-15 10:24:40
AM-008	PE-007	ACT-008	1	0.70	keyword	t	2026-09-15 10:24:40
AM-009	PE-008	ACT-009	1	0.80	keyword	t	2026-09-15 10:24:40
AM-010	PE-009	ACT-008	1	0.85	keyword	t	2026-09-15 10:24:40
AM-011	PE-010	ACT-010	1	0.75	keyword	t	2026-09-15 10:24:40
AM-012	PE-011	ACT-008	1	0.82	keyword	t	2026-09-15 10:24:40
AM-013	PE-012	ACT-009	1	0.78	keyword	t	2026-09-15 10:24:40
AM-014	PE-013	ACT-011	1	0.88	keyword	t	2026-09-15 10:24:40
AM-015	PE-014	ACT-013	1	0.80	keyword	t	2026-09-15 10:24:40
AM-016	PE-015	ACT-014	1	0.85	keyword	t	2026-09-15 10:24:40
AM-017	PE-016	ACT-015	1	0.90	keyword	t	2026-09-15 10:24:40
AM-018	PE-017	ACT-016	1	0.80	keyword	t	2026-09-15 10:24:40
AM-019	PE-018	ACT-017	1	0.85	keyword	t	2026-09-15 10:24:40
AM-020	PE-019	ACT-018	1	0.85	keyword	t	2026-09-15 10:24:40
AM-021	PE-020	ACT-019	1	0.80	keyword	t	2026-09-15 10:24:40
AM-022	PE-021	ACT-020	1	0.80	keyword	t	2026-09-15 10:24:40
AM-023	PE-022	ACT-021	1	0.80	keyword	t	2026-09-15 10:24:40
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (audit_id, entity_table, entity_id, action, field_changed, old_value, new_value, changed_by, changed_at, remarks) FROM stdin;
AL-001	progress_events	PE-001	CREATE	\N	\N	\N	system/etl_pipeline	2026-09-15 10:24:40	Progress event created by initial extraction run from SR-01.
AL-002	progress_events	PE-003	REVIEW	extraction_confidence	\N	0.50	system	2026-09-15 10:24:40	Auto-flagged: source text is explicitly unsure of the figure ('maybe 80-90%?') and defers confirmation to the next day, which never arrives in the available reports.
AL-003	activity_matches	AM-006	REVIEW	\N	\N	\N	system	2026-09-15 10:24:40	Two candidate activities both below the confidence threshold (0.55 / 0.30). Source report itself says the team is unsure whether this slab is GF or plinth-related, pending drawing review — needs manual resolution.
AL-004	progress_events	PE-011	REVIEW	\N	\N	\N	system	2026-09-15 10:24:40	Status derived from a contractor verbal update only; SR-09 states the supervisor did not personally verify this figure.
AL-005	progress_events	PE-012	REVIEW	pct_is_estimated	\N	1	system	2026-09-15 10:24:40	Percentage ('maybe 60%?') is explicitly tentative and, per SR-09, not verified by the supervisor.
AL-006	progress_events	PE-017	REVIEW	\N	\N	\N	system	2026-09-15 10:24:40	Contractor reported internal plastering as 'started'; SR-13 notes no area could be independently verified during the site visit.
AL-007	progress_events	PE-019	REVIEW	\N	\N	\N	system	2026-09-15 10:24:40	Only stacked/delivered duct sections were visually confirmed in SR-14; actual fixing/installation is not clearly evidenced.
\.


--
-- Data for Name: progress_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.progress_events (event_id, report_id, normalized_date, activity_mention_text, extracted_status, extracted_progress_pct, pct_is_estimated, extraction_confidence, extraction_method, created_at) FROM stdin;
PE-001	SR-01	2026-02-05	excavation near block A	in_progress	\N	f	0.80	rule_based	2026-09-15 10:24:40
PE-002	SR-02	2026-02-18	footing casting grid 1-4	in_progress	\N	f	0.80	rule_based	2026-09-15 10:24:40
PE-003	SR-03	2026-02-22	plinth backfilling	ambiguous	85.00	t	0.50	llm	2026-09-15 10:24:40
PE-004	SR-04	2026-03-02	GF column shuttering C1-C6	in_progress	\N	f	0.80	rule_based	2026-09-15 10:24:40
PE-005	SR-05	2026-03-10	GF column casting, 18 of ~22 columns	delayed	81.82	t	0.65	llm	2026-09-15 10:24:40
PE-006	SR-06	2026-03-20	slab shuttering, GF/plinth unclear	ambiguous	50.00	t	0.35	llm	2026-09-15 10:24:40
PE-007	SR-07	2026-04-05	brickwork GF walls (materials only)	not_started	\N	f	0.60	rule_based	2026-09-15 10:24:40
PE-008	SR-07	2026-04-05	electrical conduit, rain-blocked	delayed	\N	f	0.70	rule_based	2026-09-15 10:24:40
PE-009	SR-08	2026-04-06	brickwork GF walls ongoing, amount unclear	ambiguous	\N	f	0.50	llm	2026-09-15 10:24:40
PE-010	SR-08	2026-04-06	plumbing rough-in GF, marking only	not_started	\N	f	0.55	rule_based	2026-09-15 10:24:40
PE-011	SR-09	2026-04-18	brickwork GF caught up (unverified)	in_progress	\N	f	0.60	llm	2026-09-15 10:24:40
PE-012	SR-09	2026-04-18	electrical conduit ~60% (unverified)	in_progress	60.00	t	0.50	llm	2026-09-15 10:24:40
PE-013	SR-10	2026-05-01	FF column casting started early (C1-C3)	ambiguous	\N	f	0.75	rule_based	2026-09-15 10:24:40
PE-014	SR-11	2026-05-15	FF brickwork, rough mid-way guess	ambiguous	50.00	t	0.40	llm	2026-09-15 10:24:40
PE-015	SR-12	2026-06-02	roof slab shuttering complete, reinf ongoing	in_progress	\N	f	0.75	rule_based	2026-09-15 10:24:40
PE-016	SR-13	2026-06-15	external plastering, south facade only	in_progress	\N	f	0.80	rule_based	2026-09-15 10:24:40
PE-017	SR-13	2026-06-15	internal plastering claimed started (unverified)	ambiguous	\N	f	0.30	llm	2026-09-15 10:24:40
PE-018	SR-14	2026-07-02	electrical wiring 'in progress', no pct	ambiguous	\N	f	0.45	llm	2026-09-15 10:24:40
PE-019	SR-14	2026-07-02	HVAC ducting stacked, not confirmed fixed	ambiguous	\N	f	0.40	llm	2026-09-15 10:24:40
PE-020	SR-15	2026-08-05	flooring tiles, partial delivery only	not_started	\N	f	0.60	rule_based	2026-09-15 10:24:40
PE-021	SR-15	2026-08-05	painting primer coat, 2 rooms	in_progress	\N	f	0.55	rule_based	2026-09-15 10:24:40
PE-022	SR-15	2026-08-05	road subgrade prep near main gate	in_progress	\N	f	0.60	rule_based	2026-09-15 10:24:40
\.


--
-- Data for Name: project_activities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_activities (activity_id, activity_name, discipline, planned_start_date, planned_end_date) FROM stdin;
ACT-001	Site clearance and mobilization	Earthwork	2026-01-05	2026-01-12
ACT-002	Excavation for foundation	Earthwork	2026-01-13	2026-01-25
ACT-003	PCC (Plain Cement Concrete) laying	Civil	2026-01-26	2026-01-31
ACT-004	Foundation footing casting	Structural	2026-02-01	2026-02-14
ACT-005	Backfilling and plinth level work	Earthwork	2026-02-15	2026-02-22
ACT-006	Column casting - ground floor	Structural	2026-02-23	2026-03-10
ACT-007	Slab casting - ground floor	Structural	2026-03-11	2026-03-22
ACT-008	Brickwork - ground floor walls	Civil	2026-03-23	2026-04-08
ACT-009	Electrical conduit laying - GF	Electrical	2026-03-25	2026-04-05
ACT-010	Plumbing rough-in - GF	Plumbing	2026-03-25	2026-04-05
ACT-011	Column casting - first floor	Structural	2026-04-09	2026-04-24
ACT-012	Slab casting - first floor	Structural	2026-04-25	2026-05-06
ACT-013	Brickwork - first floor walls	Civil	2026-05-07	2026-05-22
ACT-014	Roof slab casting	Structural	2026-05-23	2026-06-05
ACT-015	External plastering	Civil	2026-06-06	2026-06-25
ACT-016	Internal plastering	Civil	2026-06-10	2026-06-28
ACT-017	Electrical wiring and fixtures	Electrical	2026-06-29	2026-07-20
ACT-018	HVAC ducting installation	HVAC	2026-06-29	2026-07-25
ACT-019	Flooring works (tiling)	Finishing	2026-07-21	2026-08-10
ACT-020	Painting - internal and external	Finishing	2026-08-11	2026-08-30
ACT-021	Road and pavement works	Civil	2026-08-01	2026-08-28
ACT-022	Final cleanup and handover	General	2026-08-29	2026-09-05
\.


--
-- Data for Name: site_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.site_reports (report_id, report_date, reported_by, weather, raw_report_text) FROM stdin;
SR-01	05-02-2026	R. Naidu	Cloudy	Excavation work going on near block A. Depth achieved approx 2.1m in some pits, less in others. Labour shortage today (only 8 out of 15 turned up). Progress slow.
SR-02	2026/02/18	site eng.	Clear	Footing cstng started for grid 1-4. Concrete pour done for 2 footings, remaining postponed to tmrw due to late arrival of RMC truck. Quality check pending.
SR-03	22 Feb 26	Naidu	-	Plinth backfilling almost complete, maybe 80-90%? Some area near east wing still waterlogged from yesterday's rain, work paused there. Will confirm exact % tomorrow.
SR-04	2026-03-02	S.K.	Sunny	Column shuttering for GF columns C1-C6 done. Reinforcement checked by consultant, minor observation on cover blocks - to be corrected before pour. No casting today.
SR-05	10/03/2026	Ramesh	Hot	GF column casting substantially complete, 18 of ~22 columns cast till date. Rest held up bc of rebar shortage from supplier. Site engineer says supply expected 'soon' - no confirmed date given.
SR-06	2026-03-20	R.Naidu	Clear	Slab shuttering ground floor in progress, roughly half the area shuttered. Some confusion whether this slab is for GF or the plinth - drawings under review, team proceeding based on old rev of drawing for now.
SR-07	05-04-26	unknown	Rain	No major work today due to heavy rain since morning. Brick delivery arrived on site (approx 40% of total qty). Electrical team also came but could not start conduit work, materials stored in shed.
SR-08	2026-04-06	S. Kumar	Overcast	Brickwork GF walls ongoing, about 3 courses done on north and west sides. Plumbing team started marking for rough-in but actual pipe laying not begun yet. Status: in progress, unclear how much.
SR-09	18 April 2026	Site Sup	Clear	Update: brickwork gf reported earlier as delayed is now caught up, team worked double shift over weekend. Electrical conduit also progressed well, maybe 60%? Not verified by supervisor personally, based on contractor's verbal update only.
SR-10	2026-05-01	Ramesh K.	Sunny	1st floor column work started for few columns (C1-C3 area only). Note: this activity was originally planned to start after roof, but team moved ahead on this section while slab curing continues elsewhere - sequence looks off, need PM to confirm if this is intentional.
SR-11	2026-05-15	R. Naidu	Humid	1st floor brickwork - some walls up to lintel level, others just started. Overall job appears to be around mid-way but no measurement book entry done this week so figure is a rough guess from site walk.
SR-12	02/06/2026	S.K	Clear	Roof slab shuttering complete for entire roof area. Reinforcement work ongoing. Casting tentatively planned in next few days, exact date depends on concrete pump availability which contractor has not confirmed yet.
SR-13	2026-06-15	site engineer	Clear	External plastering started on south facade only. Internal plastering also reported by contractor as 'started' but no area could be verified during site visit today - contractor's claim not independently confirmed.
SR-14	2026-07-02	Ramesh	Hot	Electrical wiring work and HVAC duct work both mentioned in contractor's daily diary as 'in progress' with no percentage given. Site visit showed some duct sections stacked near 1st floor, actual fixing not clearly visible.
SR-15	2026-08-05	R.Naidu / S.K.	Overcast	Mixed update: flooring tiles delivered (partial lot), painting primer coat done on 2 rooms only, road work subgrade prep ongoing near main gate. Multiple activities touched today, none fully complete - overall status best described as 'various, in progress'.
\.


--
-- Name: activity_matches activity_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_matches
    ADD CONSTRAINT activity_matches_pkey PRIMARY KEY (match_id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (audit_id);


--
-- Name: progress_events progress_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.progress_events
    ADD CONSTRAINT progress_events_pkey PRIMARY KEY (event_id);


--
-- Name: project_activities project_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_activities
    ADD CONSTRAINT project_activities_pkey PRIMARY KEY (activity_id);


--
-- Name: site_reports site_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_reports
    ADD CONSTRAINT site_reports_pkey PRIMARY KEY (report_id);


--
-- Name: activity_matches uq_matches_event_rank; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_matches
    ADD CONSTRAINT uq_matches_event_rank UNIQUE (event_id, match_rank);


--
-- Name: idx_activities_discipline; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activities_discipline ON public.project_activities USING btree (discipline);


--
-- Name: idx_activities_start_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activities_start_date ON public.project_activities USING btree (planned_start_date);


--
-- Name: idx_audit_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_entity ON public.audit_logs USING btree (entity_table, entity_id);


--
-- Name: idx_audit_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_time ON public.audit_logs USING btree (changed_at);


--
-- Name: idx_events_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_date ON public.progress_events USING btree (normalized_date);


--
-- Name: idx_events_report; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_report ON public.progress_events USING btree (report_id);


--
-- Name: idx_events_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_status ON public.progress_events USING btree (extracted_status);


--
-- Name: idx_matches_activity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_activity ON public.activity_matches USING btree (activity_id);


--
-- Name: idx_matches_event; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_event ON public.activity_matches USING btree (event_id);


--
-- Name: idx_reports_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reports_by ON public.site_reports USING btree (reported_by);


--
-- Name: idx_reports_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reports_date ON public.site_reports USING btree (report_date);


--
-- Name: activity_matches activity_matches_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_matches
    ADD CONSTRAINT activity_matches_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.project_activities(activity_id);


--
-- Name: activity_matches activity_matches_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_matches
    ADD CONSTRAINT activity_matches_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.progress_events(event_id);


--
-- Name: progress_events progress_events_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.progress_events
    ADD CONSTRAINT progress_events_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.site_reports(report_id);


--
-- PostgreSQL database dump complete
--

\unrestrict AgWj21FzfnX6pPjFsfNALf8XTLmWqwAmYhWae5aabxVJrSgYkJUjwGxu0XwXeTj
