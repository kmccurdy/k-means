# streamlined harburg tide data processing

library(df2json)

# gets tide data for 2 years starting Jan 1 2013
# can change year-month-day params in query to start at other times
url = "http://tbone.biol.sc.edu/tide/tideshow.cgi?type=table;tplotdir=horiz;gx=640;gy=240;caltype=ndp;interval=00%3A01;glen=731;fontsize=%2B0;units=default;cleanout=1;year=2013;month=01;day=01;hour=00;min=00;tzone=utc;d_year=;d_month=01;d_day=01;d_hour=00;d_min=00;ampm24=24;weekday=1;colortext=black;colordatum=white;colormsl=yellow;colortics=red;colorday=skyblue;colornight=deep-%3Cbr%20%2F%3Eskyblue;colorebb=seagreen;colorflood=blue;site=Harburg%2C%20Schleuse%2C%20Germany"
json.filepath = "~/dev/k-means/projects/zeitgeber/2013.json"

ht = readLines(url)

# for reference
timespan = ht[42]

ht = ht[44:5841]
ht. = data.frame(date = substr(ht,1,10),
                 time = substr(ht,16,20),
                 weekday = substr(ht,12,14),
                 utc = as.POSIXct(paste(substr(ht,1,10),substr(ht,16,24))),
                 event = gsub("^\\s+|\\s+$", "", substr(ht, nchar(ht)-8,nchar(ht))))

# we're just interested in 2013 for now
ht. = ht.[substr(ht.$date,1,4)=="2013",]

cat(df2json(ht.), file=json.filepath)